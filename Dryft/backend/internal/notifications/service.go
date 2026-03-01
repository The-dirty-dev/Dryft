package notifications

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/sideshow/apns2"
	"github.com/sideshow/apns2/payload"
	"github.com/sideshow/apns2/token"
	"google.golang.org/api/option"

	"github.com/dryft-app/backend/internal/config"
	"github.com/dryft-app/backend/internal/database"
)

var (
	ErrDeviceNotFound = errors.New("device not found")
	ErrInvalidToken   = errors.New("invalid device token")
)

// NotificationType represents the type of notification
type NotificationType string

const (
	NotificationTypeNewMatch   NotificationType = "new_match"
	NotificationTypeNewMessage NotificationType = "new_message"
	NotificationTypeNewLike    NotificationType = "new_like"
	NotificationTypeSystem     NotificationType = "system"
)

// DevicePlatform represents the device platform
type DevicePlatform string

const (
	PlatformIOS     DevicePlatform = "ios"
	PlatformAndroid DevicePlatform = "android"
	PlatformWeb     DevicePlatform = "web"
)

// Device represents a registered device for push notifications
type Device struct {
	ID        uuid.UUID      `json:"id"`
	UserID    uuid.UUID      `json:"user_id"`
	Token     string         `json:"token"`
	Platform  DevicePlatform `json:"platform"`
	DeviceID  string         `json:"device_id"` // Unique device identifier
	AppVersion string        `json:"app_version,omitempty"`
	IsActive  bool           `json:"is_active"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
}

// Notification represents a notification to be sent
type Notification struct {
	Type      NotificationType       `json:"type"`
	Title     string                 `json:"title"`
	Body      string                 `json:"body"`
	ImageURL  string                 `json:"image_url,omitempty"`
	Data      map[string]string      `json:"data,omitempty"`
	Badge     int                    `json:"badge,omitempty"`
	Sound     string                 `json:"sound,omitempty"`
}

// Service handles push notifications
type Service struct {
	db          *database.DB
	fcmClient   *messaging.Client
	apnsClient  *apns2.Client
	cfg         *config.Config
	rateLimiter *RateLimiter
}

// NewService creates a new notification service
func NewService(cfg *config.Config, db *database.DB) (*Service, error) {
	svc := &Service{
		db:          db,
		cfg:         cfg,
		rateLimiter: NewRateLimiter(),
	}

	// Initialize Firebase if credentials are provided
	if cfg.FirebaseCredentialsJSON != "" {
		opt := option.WithCredentialsJSON([]byte(cfg.FirebaseCredentialsJSON))
		app, err := firebase.NewApp(context.Background(), nil, opt)
		if err != nil {
			return nil, fmt.Errorf("initialize firebase: %w", err)
		}

		fcmClient, err := app.Messaging(context.Background())
		if err != nil {
			return nil, fmt.Errorf("initialize FCM client: %w", err)
		}

		svc.fcmClient = fcmClient
		log.Println("[Notifications] Firebase initialized successfully")
	} else {
		log.Println("[Notifications] Firebase credentials not configured, FCM disabled")
	}

	// Initialize APNs client for iOS VoIP push
	if cfg.APNsAuthKey != "" && cfg.APNsKeyID != "" && cfg.APNsTeamID != "" {
		authKey, err := token.AuthKeyFromBytes([]byte(cfg.APNsAuthKey))
		if err != nil {
			log.Printf("[Notifications] Failed to parse APNs auth key: %v", err)
		} else {
			apnsToken := &token.Token{
				AuthKey: authKey,
				KeyID:   cfg.APNsKeyID,
				TeamID:  cfg.APNsTeamID,
			}

			if cfg.APNsProduction {
				svc.apnsClient = apns2.NewTokenClient(apnsToken).Production()
			} else {
				svc.apnsClient = apns2.NewTokenClient(apnsToken).Development()
			}
			log.Println("[Notifications] APNs VoIP client initialized successfully")
		}
	} else {
		log.Println("[Notifications] APNs credentials not configured, VoIP push disabled")
	}

	return svc, nil
}

// RegisterDevice registers or updates a device token
func (s *Service) RegisterDevice(ctx context.Context, userID uuid.UUID, token string, platform DevicePlatform, deviceID, appVersion string) (*Device, error) {
	if token == "" {
		return nil, ErrInvalidToken
	}

	now := time.Now()
	device := &Device{
		ID:         uuid.New(),
		UserID:     userID,
		Token:      token,
		Platform:   platform,
		DeviceID:   deviceID,
		AppVersion: appVersion,
		IsActive:   true,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	// Upsert device - update if same device_id exists, insert otherwise
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO push_devices (id, user_id, token, platform, device_id, app_version, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (user_id, device_id)
		DO UPDATE SET token = $3, platform = $4, app_version = $6, is_active = $7, updated_at = $9
	`, device.ID, userID, token, platform, deviceID, appVersion, true, now, now)

	if err != nil {
		return nil, fmt.Errorf("register device: %w", err)
	}

	// Deactivate old tokens with the same token but different user
	// (in case user logged out and someone else logged in)
	_, _ = s.db.Pool.Exec(ctx, `
		UPDATE push_devices SET is_active = false
		WHERE token = $1 AND user_id != $2
	`, token, userID)

	return device, nil
}

// UnregisterDevice removes a device token
func (s *Service) UnregisterDevice(ctx context.Context, userID uuid.UUID, deviceID string) error {
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE push_devices SET is_active = false, updated_at = NOW()
		WHERE user_id = $1 AND device_id = $2
	`, userID, deviceID)

	if err != nil {
		return fmt.Errorf("unregister device: %w", err)
	}
	return nil
}

// UnregisterAllDevices removes all device tokens for a user (on logout)
func (s *Service) UnregisterAllDevices(ctx context.Context, userID uuid.UUID) error {
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE push_devices SET is_active = false, updated_at = NOW()
		WHERE user_id = $1
	`, userID)

	if err != nil {
		return fmt.Errorf("unregister all devices: %w", err)
	}
	return nil
}

// GetUserDevices returns all active devices for a user
func (s *Service) GetUserDevices(ctx context.Context, userID uuid.UUID) ([]Device, error) {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, user_id, token, platform, device_id, app_version, is_active, created_at, updated_at
		FROM push_devices
		WHERE user_id = $1 AND is_active = true
	`, userID)

	if err != nil {
		return nil, fmt.Errorf("get user devices: %w", err)
	}
	defer rows.Close()

	var devices []Device
	for rows.Next() {
		var d Device
		if err := rows.Scan(&d.ID, &d.UserID, &d.Token, &d.Platform, &d.DeviceID, &d.AppVersion, &d.IsActive, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan device: %w", err)
		}
		devices = append(devices, d)
	}

	return devices, nil
}

// SendToUser sends a notification to all of a user's devices
func (s *Service) SendToUser(ctx context.Context, userID uuid.UUID, notification *Notification) error {
	// Check if user has notifications enabled for this type
	enabled, err := s.isNotificationEnabled(ctx, userID, notification.Type)
	if err != nil {
		log.Printf("[Notifications] Error checking preferences: %v", err)
	}
	if !enabled {
		log.Printf("[Notifications] User %s has disabled %s notifications", userID, notification.Type)
		return nil
	}

	// Check rate limit
	if s.rateLimiter != nil {
		result := s.rateLimiter.Check(userID, notification)
		if !result.Allowed {
			if result.IsDuplicate {
				log.Printf("[Notifications] Duplicate notification blocked for user %s: %s", userID, notification.Type)
			} else {
				log.Printf("[Notifications] Rate limit exceeded for user %s: %s (retry in %v)", userID, notification.Type, result.RetryAfter)
			}
			return nil // Silently drop rate-limited notifications
		}
	}

	devices, err := s.GetUserDevices(ctx, userID)
	if err != nil {
		return err
	}

	if len(devices) == 0 {
		log.Printf("[Notifications] No devices registered for user %s", userID)
		return nil
	}

	sentCount := 0
	for _, device := range devices {
		if err := s.sendToDevice(ctx, &device, notification); err != nil {
			log.Printf("[Notifications] Failed to send to device %s: %v", device.ID, err)
			// Mark device as inactive if token is invalid
			if errors.Is(err, ErrInvalidToken) {
				s.markDeviceInactive(ctx, device.ID)
			}
		} else {
			sentCount++
		}
	}

	// Record notification for rate limiting (only if at least one was sent)
	if sentCount > 0 && s.rateLimiter != nil {
		s.rateLimiter.Record(userID, notification)
	}

	return nil
}

// SendToUsers sends a notification to multiple users
func (s *Service) SendToUsers(ctx context.Context, userIDs []uuid.UUID, notification *Notification) error {
	for _, userID := range userIDs {
		if err := s.SendToUser(ctx, userID, notification); err != nil {
			log.Printf("[Notifications] Failed to send to user %s: %v", userID, err)
		}
	}
	return nil
}

// SendToUserUrgent sends a notification bypassing rate limits (for critical notifications like calls)
func (s *Service) SendToUserUrgent(ctx context.Context, userID uuid.UUID, notification *Notification) error {
	// Check if user has notifications enabled for this type
	enabled, err := s.isNotificationEnabled(ctx, userID, notification.Type)
	if err != nil {
		log.Printf("[Notifications] Error checking preferences: %v", err)
	}
	if !enabled {
		log.Printf("[Notifications] User %s has disabled %s notifications", userID, notification.Type)
		return nil
	}

	// Skip rate limiting for urgent notifications
	devices, err := s.GetUserDevices(ctx, userID)
	if err != nil {
		return err
	}

	if len(devices) == 0 {
		log.Printf("[Notifications] No devices registered for user %s", userID)
		return nil
	}

	for _, device := range devices {
		if err := s.sendToDevice(ctx, &device, notification); err != nil {
			log.Printf("[Notifications] Failed to send urgent to device %s: %v", device.ID, err)
			if errors.Is(err, ErrInvalidToken) {
				s.markDeviceInactive(ctx, device.ID)
			}
		}
	}

	return nil
}

// GetRateLimitStats returns rate limiting statistics for a user
func (s *Service) GetRateLimitStats(userID uuid.UUID) map[string]interface{} {
	if s.rateLimiter == nil {
		return map[string]interface{}{"enabled": false}
	}

	stats := map[string]interface{}{
		"enabled": true,
		"limits":  make(map[string]interface{}),
	}

	limitsMap := stats["limits"].(map[string]interface{})

	for notifType := range DefaultRateLimits {
		sent, remaining, resetIn := s.rateLimiter.GetStats(userID, notifType)
		limitsMap[string(notifType)] = map[string]interface{}{
			"sent":       sent,
			"remaining":  remaining,
			"reset_in_s": int(resetIn.Seconds()),
		}
	}

	return stats
}

// sendToDevice sends a notification to a specific device
func (s *Service) sendToDevice(ctx context.Context, device *Device, notification *Notification) error {
	if s.fcmClient == nil {
		log.Printf("[Notifications] FCM not configured, skipping notification to %s", device.Token[:20])
		return nil
	}

	// Build FCM message
	message := &messaging.Message{
		Token: device.Token,
		Notification: &messaging.Notification{
			Title:    notification.Title,
			Body:     notification.Body,
			ImageURL: notification.ImageURL,
		},
		Data: notification.Data,
	}

	// Platform-specific configuration
	switch device.Platform {
	case PlatformIOS:
		message.APNS = &messaging.APNSConfig{
			Payload: &messaging.APNSPayload{
				Aps: &messaging.Aps{
					Alert: &messaging.ApsAlert{
						Title: notification.Title,
						Body:  notification.Body,
					},
					Badge:            &notification.Badge,
					Sound:            notification.Sound,
					MutableContent:   true,
					ContentAvailable: true,
				},
			},
		}
	case PlatformAndroid:
		message.Android = &messaging.AndroidConfig{
			Priority: "high",
			Notification: &messaging.AndroidNotification{
				Title:       notification.Title,
				Body:        notification.Body,
				Icon:        "ic_notification",
				Color:       "#e94560",
				Sound:       notification.Sound,
				ClickAction: "OPEN_APP",
			},
		}
	case PlatformWeb:
		message.Webpush = &messaging.WebpushConfig{
			Notification: &messaging.WebpushNotification{
				Title: notification.Title,
				Body:  notification.Body,
				Icon:  "/icon-192.png",
			},
		}
	}

	// Add notification type to data
	if message.Data == nil {
		message.Data = make(map[string]string)
	}
	message.Data["type"] = string(notification.Type)

	// Send message
	_, err := s.fcmClient.Send(ctx, message)
	if err != nil {
		if messaging.IsUnregistered(err) || messaging.IsInvalidArgument(err) {
			return ErrInvalidToken
		}
		return fmt.Errorf("send FCM message: %w", err)
	}

	log.Printf("[Notifications] Sent %s to device %s", notification.Type, device.ID)
	return nil
}

// isNotificationEnabled checks if a user has enabled notifications for a specific type
func (s *Service) isNotificationEnabled(ctx context.Context, userID uuid.UUID, notifType NotificationType) (bool, error) {
	var prefsJSON []byte
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COALESCE(preferences, '{}')
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
	`, userID).Scan(&prefsJSON)

	if err == pgx.ErrNoRows {
		return true, nil // Default to enabled
	}
	if err != nil {
		return true, err
	}

	var prefs struct {
		NotifyMatches  bool `json:"notify_matches"`
		NotifyMessages bool `json:"notify_messages"`
		NotifyLikes    bool `json:"notify_likes"`
	}
	// Default to true
	prefs.NotifyMatches = true
	prefs.NotifyMessages = true
	prefs.NotifyLikes = true

	if len(prefsJSON) > 0 {
		json.Unmarshal(prefsJSON, &prefs)
	}

	switch notifType {
	case NotificationTypeNewMatch:
		return prefs.NotifyMatches, nil
	case NotificationTypeNewMessage:
		return prefs.NotifyMessages, nil
	case NotificationTypeNewLike:
		return prefs.NotifyLikes, nil
	default:
		return true, nil
	}
}

// markDeviceInactive marks a device as inactive (invalid token)
func (s *Service) markDeviceInactive(ctx context.Context, deviceID uuid.UUID) {
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE push_devices SET is_active = false, updated_at = NOW()
		WHERE id = $1
	`, deviceID)
	if err != nil {
		log.Printf("[Notifications] Failed to mark device inactive: %v", err)
	}
}

// SaveNotification saves a notification to the database for history
func (s *Service) SaveNotification(ctx context.Context, userID uuid.UUID, notification *Notification) error {
	dataJSON, _ := json.Marshal(notification.Data)

	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO notification_history (id, user_id, type, title, body, data, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, uuid.New(), userID, notification.Type, notification.Title, notification.Body, dataJSON, time.Now())

	if err != nil {
		return fmt.Errorf("save notification: %w", err)
	}
	return nil
}

// GetNotificationHistory returns notification history for a user
func (s *Service) GetNotificationHistory(ctx context.Context, userID uuid.UUID, limit, offset int) ([]map[string]interface{}, error) {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, type, title, body, data, read_at, created_at
		FROM notification_history
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, limit, offset)

	if err != nil {
		return nil, fmt.Errorf("get notification history: %w", err)
	}
	defer rows.Close()

	var notifications []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var notifType, title, body string
		var dataJSON []byte
		var readAt *time.Time
		var createdAt time.Time

		if err := rows.Scan(&id, &notifType, &title, &body, &dataJSON, &readAt, &createdAt); err != nil {
			return nil, fmt.Errorf("scan notification: %w", err)
		}

		notif := map[string]interface{}{
			"id":         id.String(),
			"type":       notifType,
			"title":      title,
			"body":       body,
			"created_at": createdAt.UnixMilli(),
		}

		if len(dataJSON) > 0 {
			var data map[string]interface{}
			json.Unmarshal(dataJSON, &data)
			notif["data"] = data
		}

		if readAt != nil {
			notif["read_at"] = readAt.UnixMilli()
		}

		notifications = append(notifications, notif)
	}

	return notifications, nil
}

// MarkNotificationRead marks a notification as read
func (s *Service) MarkNotificationRead(ctx context.Context, userID, notificationID uuid.UUID) error {
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE notification_history SET read_at = NOW()
		WHERE id = $1 AND user_id = $2 AND read_at IS NULL
	`, notificationID, userID)

	if err != nil {
		return fmt.Errorf("mark notification read: %w", err)
	}
	return nil
}

// MarkAllNotificationsRead marks all notifications as read for a user
func (s *Service) MarkAllNotificationsRead(ctx context.Context, userID uuid.UUID) error {
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE notification_history SET read_at = NOW()
		WHERE user_id = $1 AND read_at IS NULL
	`, userID)

	if err != nil {
		return fmt.Errorf("mark all notifications read: %w", err)
	}
	return nil
}

// GetUnreadCount returns the number of unread notifications for a user
func (s *Service) GetUnreadCount(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM notification_history
		WHERE user_id = $1 AND read_at IS NULL
	`, userID).Scan(&count)

	if err != nil {
		return 0, fmt.Errorf("get unread count: %w", err)
	}
	return count, nil
}

// ============================================================================
// VoIP Push (iOS APNs for incoming calls)
// ============================================================================

// VoIPDevice represents a registered iOS device for VoIP push
type VoIPDevice struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Token     string    `json:"token"`
	BundleID  string    `json:"bundle_id"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// VoIPCallPayload is the payload for incoming call VoIP push
type VoIPCallPayload struct {
	CallID       string `json:"call_id"`
	CallerID     string `json:"caller_id"`
	CallerName   string `json:"caller_name"`
	CallerPhoto  string `json:"caller_photo,omitempty"`
	MatchID      string `json:"match_id"`
	VideoEnabled bool   `json:"video_enabled"`
}

// RegisterVoIPDevice registers or updates a VoIP device token
func (s *Service) RegisterVoIPDevice(ctx context.Context, userID uuid.UUID, token, bundleID string) (*VoIPDevice, error) {
	if token == "" || bundleID == "" {
		return nil, ErrInvalidToken
	}

	now := time.Now()
	device := &VoIPDevice{
		ID:        uuid.New(),
		UserID:    userID,
		Token:     token,
		BundleID:  bundleID,
		IsActive:  true,
		CreatedAt: now,
		UpdatedAt: now,
	}

	// Upsert device
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO voip_devices (id, user_id, token, bundle_id, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (user_id, bundle_id)
		DO UPDATE SET token = $3, is_active = $5, updated_at = $7
	`, device.ID, userID, token, bundleID, true, now, now)

	if err != nil {
		return nil, fmt.Errorf("register voip device: %w", err)
	}

	// Deactivate old tokens with same token but different user
	_, _ = s.db.Pool.Exec(ctx, `
		UPDATE voip_devices SET is_active = false
		WHERE token = $1 AND user_id != $2
	`, token, userID)

	log.Printf("[Notifications] VoIP device registered for user %s", userID)
	return device, nil
}

// UnregisterVoIPDevice removes a VoIP device token
func (s *Service) UnregisterVoIPDevice(ctx context.Context, userID uuid.UUID, token string) error {
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE voip_devices SET is_active = false, updated_at = NOW()
		WHERE user_id = $1 AND token = $2
	`, userID, token)

	if err != nil {
		return fmt.Errorf("unregister voip device: %w", err)
	}
	return nil
}

// GetUserVoIPDevices returns all active VoIP devices for a user
func (s *Service) GetUserVoIPDevices(ctx context.Context, userID uuid.UUID) ([]VoIPDevice, error) {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, user_id, token, bundle_id, is_active, created_at, updated_at
		FROM voip_devices
		WHERE user_id = $1 AND is_active = true
	`, userID)

	if err != nil {
		return nil, fmt.Errorf("get user voip devices: %w", err)
	}
	defer rows.Close()

	var devices []VoIPDevice
	for rows.Next() {
		var d VoIPDevice
		if err := rows.Scan(&d.ID, &d.UserID, &d.Token, &d.BundleID, &d.IsActive, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan voip device: %w", err)
		}
		devices = append(devices, d)
	}

	return devices, nil
}

// SendVoIPPush sends a VoIP push notification for an incoming call
// This uses APNs directly (not FCM) for iOS VoIP push
func (s *Service) SendVoIPPush(ctx context.Context, userID uuid.UUID, voipPayload *VoIPCallPayload) error {
	devices, err := s.GetUserVoIPDevices(ctx, userID)
	if err != nil {
		return err
	}

	if len(devices) == 0 {
		log.Printf("[Notifications] No VoIP devices registered for user %s", userID)
		return nil
	}

	// Check if APNs client is configured
	if s.apnsClient == nil {
		log.Printf("[Notifications] APNs client not configured, skipping VoIP push for user %s", userID)
		return nil
	}

	// Build VoIP push payload
	// This is the payload that will be delivered to the app via PushKit
	p := payload.NewPayload().Custom("payload", map[string]interface{}{
		"call_id":       voipPayload.CallID,
		"caller_id":     voipPayload.CallerID,
		"caller_name":   voipPayload.CallerName,
		"caller_photo":  voipPayload.CallerPhoto,
		"match_id":      voipPayload.MatchID,
		"video_enabled": voipPayload.VideoEnabled,
	})

	// Send to all active VoIP devices
	var lastErr error
	for _, device := range devices {
		notification := &apns2.Notification{
			DeviceToken: device.Token,
			Topic:       device.BundleID + ".voip", // VoIP topic must end with .voip
			Payload:     p,
			Priority:    apns2.PriorityHigh,
			PushType:    apns2.PushTypeVOIP,
			Expiration:  time.Now().Add(30 * time.Second), // VoIP push should be delivered quickly or not at all
		}

		resp, err := s.apnsClient.Push(notification)
		if err != nil {
			log.Printf("[Notifications] Failed to send VoIP push to device %s: %v", device.ID, err)
			lastErr = err
			continue
		}

		if resp.StatusCode == 200 {
			log.Printf("[Notifications] VoIP push sent successfully to device %s (user %s) - call_id: %s",
				device.ID, userID, voipPayload.CallID)
		} else {
			log.Printf("[Notifications] VoIP push failed for device %s: %d %s",
				device.ID, resp.StatusCode, resp.Reason)

			// Mark device as inactive if token is invalid
			if resp.Reason == apns2.ReasonBadDeviceToken ||
				resp.Reason == apns2.ReasonUnregistered ||
				resp.Reason == apns2.ReasonDeviceTokenNotForTopic {
				s.markVoIPDeviceInactive(ctx, device.ID)
			}
			lastErr = fmt.Errorf("APNs error: %s", resp.Reason)
		}
	}

	return lastErr
}

// markVoIPDeviceInactive marks a VoIP device as inactive (invalid token)
func (s *Service) markVoIPDeviceInactive(ctx context.Context, deviceID uuid.UUID) {
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE voip_devices SET is_active = false, updated_at = NOW()
		WHERE id = $1
	`, deviceID)
	if err != nil {
		log.Printf("[Notifications] Failed to mark VoIP device inactive: %v", err)
	}
}
