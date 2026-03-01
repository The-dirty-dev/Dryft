package haptic

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/dryft-app/backend/internal/database"
	"github.com/dryft-app/backend/internal/models"
	"github.com/dryft-app/backend/internal/realtime"
)

var (
	ErrDeviceNotFound       = errors.New("device not found")
	ErrPermissionDenied     = errors.New("permission denied")
	ErrNotMatched           = errors.New("users are not matched")
	ErrPermissionNotFound   = errors.New("permission not found")
	ErrInvalidIntensity     = errors.New("intensity must be between 0 and 1")
	ErrDeviceLimitExceeded  = errors.New("device limit exceeded")
)

const maxDevicesPerUser = 10

// Service handles haptic device management and commands
type Service struct {
	db  *database.DB
	hub *realtime.Hub
}

// NewService creates a new haptic service
func NewService(db *database.DB, hub *realtime.Hub) *Service {
	return &Service{
		db:  db,
		hub: hub,
	}
}

// ============================================================================
// Device Management
// ============================================================================

// RegisterDevice registers or updates a haptic device from Intiface
func (s *Service) RegisterDevice(ctx context.Context, userID uuid.UUID, req *models.RegisterDeviceRequest) (*models.HapticDevice, error) {
	// Check device limit
	var count int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM haptic_devices WHERE user_id = $1
	`, userID).Scan(&count)
	if err != nil {
		return nil, fmt.Errorf("check device count: %w", err)
	}
	if count >= maxDevicesPerUser {
		return nil, ErrDeviceLimitExceeded
	}

	now := time.Now()
	device := &models.HapticDevice{
		ID:            uuid.New(),
		UserID:        userID,
		DeviceIndex:   req.DeviceIndex,
		DeviceName:    req.DeviceName,
		DeviceAddress: req.DeviceAddress,
		CanVibrate:    req.CanVibrate,
		CanRotate:     req.CanRotate,
		CanLinear:     req.CanLinear,
		CanBattery:    req.CanBattery,
		VibrateCount:  req.VibrateCount,
		RotateCount:   req.RotateCount,
		LinearCount:   req.LinearCount,
		MaxIntensity:  1.0,
		LastConnected: &now,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	// Upsert by device address if available
	if req.DeviceAddress != nil {
		_, err = s.db.Pool.Exec(ctx, `
			INSERT INTO haptic_devices (
				id, user_id, device_index, device_name, device_address,
				can_vibrate, can_rotate, can_linear, can_battery,
				vibrate_count, rotate_count, linear_count,
				max_intensity, last_connected, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
			ON CONFLICT (user_id, device_address)
			DO UPDATE SET
				device_index = $3, device_name = $4,
				can_vibrate = $6, can_rotate = $7, can_linear = $8, can_battery = $9,
				vibrate_count = $10, rotate_count = $11, linear_count = $12,
				last_connected = $14, updated_at = $16
		`, device.ID, userID, device.DeviceIndex, device.DeviceName, device.DeviceAddress,
			device.CanVibrate, device.CanRotate, device.CanLinear, device.CanBattery,
			device.VibrateCount, device.RotateCount, device.LinearCount,
			device.MaxIntensity, device.LastConnected, device.CreatedAt, device.UpdatedAt)
	} else {
		_, err = s.db.Pool.Exec(ctx, `
			INSERT INTO haptic_devices (
				id, user_id, device_index, device_name,
				can_vibrate, can_rotate, can_linear, can_battery,
				vibrate_count, rotate_count, linear_count,
				max_intensity, last_connected, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		`, device.ID, userID, device.DeviceIndex, device.DeviceName,
			device.CanVibrate, device.CanRotate, device.CanLinear, device.CanBattery,
			device.VibrateCount, device.RotateCount, device.LinearCount,
			device.MaxIntensity, device.LastConnected, device.CreatedAt, device.UpdatedAt)
	}

	if err != nil {
		return nil, fmt.Errorf("register device: %w", err)
	}

	log.Printf("[Haptic] Device registered: user=%s, name=%s", userID, device.DeviceName)

	// Broadcast device status to matched users
	go s.broadcastDeviceStatus(userID, device, true)

	return device, nil
}

// GetUserDevices returns all devices for a user
func (s *Service) GetUserDevices(ctx context.Context, userID uuid.UUID) ([]models.HapticDevice, error) {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, user_id, device_index, device_name, device_address,
		       can_vibrate, can_rotate, can_linear, can_battery,
		       vibrate_count, rotate_count, linear_count,
		       display_name, is_primary, max_intensity,
		       last_connected, created_at, updated_at
		FROM haptic_devices
		WHERE user_id = $1
		ORDER BY is_primary DESC, created_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("get devices: %w", err)
	}
	defer rows.Close()

	var devices []models.HapticDevice
	for rows.Next() {
		var d models.HapticDevice
		if err := rows.Scan(
			&d.ID, &d.UserID, &d.DeviceIndex, &d.DeviceName, &d.DeviceAddress,
			&d.CanVibrate, &d.CanRotate, &d.CanLinear, &d.CanBattery,
			&d.VibrateCount, &d.RotateCount, &d.LinearCount,
			&d.DisplayName, &d.IsPrimary, &d.MaxIntensity,
			&d.LastConnected, &d.CreatedAt, &d.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan device: %w", err)
		}
		devices = append(devices, d)
	}

	return devices, nil
}

// GetDevice returns a specific device
func (s *Service) GetDevice(ctx context.Context, userID, deviceID uuid.UUID) (*models.HapticDevice, error) {
	var d models.HapticDevice
	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, user_id, device_index, device_name, device_address,
		       can_vibrate, can_rotate, can_linear, can_battery,
		       vibrate_count, rotate_count, linear_count,
		       display_name, is_primary, max_intensity,
		       last_connected, created_at, updated_at
		FROM haptic_devices
		WHERE id = $1 AND user_id = $2
	`, deviceID, userID).Scan(
		&d.ID, &d.UserID, &d.DeviceIndex, &d.DeviceName, &d.DeviceAddress,
		&d.CanVibrate, &d.CanRotate, &d.CanLinear, &d.CanBattery,
		&d.VibrateCount, &d.RotateCount, &d.LinearCount,
		&d.DisplayName, &d.IsPrimary, &d.MaxIntensity,
		&d.LastConnected, &d.CreatedAt, &d.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrDeviceNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get device: %w", err)
	}

	return &d, nil
}

// UpdateDevice updates device preferences
func (s *Service) UpdateDevice(ctx context.Context, userID, deviceID uuid.UUID, req *models.UpdateDeviceRequest) (*models.HapticDevice, error) {
	// Build dynamic update query
	updates := []string{}
	args := []interface{}{deviceID, userID}
	argNum := 3

	if req.DisplayName != nil {
		updates = append(updates, fmt.Sprintf("display_name = $%d", argNum))
		args = append(args, *req.DisplayName)
		argNum++
	}

	if req.IsPrimary != nil && *req.IsPrimary {
		// Clear other primary devices first
		_, _ = s.db.Pool.Exec(ctx, `
			UPDATE haptic_devices SET is_primary = false WHERE user_id = $1
		`, userID)

		updates = append(updates, fmt.Sprintf("is_primary = $%d", argNum))
		args = append(args, true)
		argNum++
	}

	if req.MaxIntensity != nil {
		if *req.MaxIntensity < 0 || *req.MaxIntensity > 1 {
			return nil, ErrInvalidIntensity
		}
		updates = append(updates, fmt.Sprintf("max_intensity = $%d", argNum))
		args = append(args, *req.MaxIntensity)
		argNum++
	}

	if len(updates) == 0 {
		return s.GetDevice(ctx, userID, deviceID)
	}

	query := fmt.Sprintf(`
		UPDATE haptic_devices SET %s, updated_at = NOW()
		WHERE id = $1 AND user_id = $2
	`, joinStrings(updates, ", "))

	result, err := s.db.Pool.Exec(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("update device: %w", err)
	}

	if result.RowsAffected() == 0 {
		return nil, ErrDeviceNotFound
	}

	return s.GetDevice(ctx, userID, deviceID)
}

// DeleteDevice removes a device
func (s *Service) DeleteDevice(ctx context.Context, userID, deviceID uuid.UUID) error {
	// Get device info first for broadcasting
	device, err := s.GetDevice(ctx, userID, deviceID)
	if err != nil {
		return err
	}

	result, err := s.db.Pool.Exec(ctx, `
		DELETE FROM haptic_devices WHERE id = $1 AND user_id = $2
	`, deviceID, userID)

	if err != nil {
		return fmt.Errorf("delete device: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrDeviceNotFound
	}

	log.Printf("[Haptic] Device deleted: user=%s, device=%s", userID, deviceID)

	// Broadcast device removal
	go s.broadcastDeviceStatus(userID, device, false)

	return nil
}

// ============================================================================
// Permission Management
// ============================================================================

// SetPermission sets haptic control permission for a matched user
func (s *Service) SetPermission(ctx context.Context, ownerID uuid.UUID, req *models.SetPermissionRequest) (*models.HapticPermission, error) {
	// Verify users are matched
	if !s.areUsersMatched(ctx, ownerID, req.ControllerID, req.MatchID) {
		return nil, ErrNotMatched
	}

	now := time.Now()
	var expiresAt *time.Time
	if req.DurationMins != nil {
		t := now.Add(time.Duration(*req.DurationMins) * time.Minute)
		expiresAt = &t
	}

	maxIntensity := 1.0
	if req.MaxIntensity != nil {
		maxIntensity = *req.MaxIntensity
	}

	perm := &models.HapticPermission{
		ID:             uuid.New(),
		OwnerID:        ownerID,
		ControllerID:   req.ControllerID,
		MatchID:        req.MatchID,
		PermissionType: req.PermissionType,
		MaxIntensity:   maxIntensity,
		ExpiresAt:      expiresAt,
		GrantedAt:      now,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	// Upsert permission
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO haptic_permissions (
			id, owner_id, controller_id, match_id,
			permission_type, max_intensity, expires_at,
			granted_at, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (owner_id, controller_id, match_id)
		DO UPDATE SET
			permission_type = $5, max_intensity = $6, expires_at = $7,
			revoked_at = NULL, updated_at = $10
	`, perm.ID, perm.OwnerID, perm.ControllerID, perm.MatchID,
		perm.PermissionType, perm.MaxIntensity, perm.ExpiresAt,
		perm.GrantedAt, perm.CreatedAt, perm.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("set permission: %w", err)
	}

	log.Printf("[Haptic] Permission set: owner=%s, controller=%s, type=%s",
		ownerID, req.ControllerID, req.PermissionType)

	return perm, nil
}

// GetPermission gets the current permission between two users
func (s *Service) GetPermission(ctx context.Context, ownerID, controllerID, matchID uuid.UUID) (*models.HapticPermission, error) {
	var p models.HapticPermission
	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, owner_id, controller_id, match_id,
		       permission_type, max_intensity, expires_at,
		       granted_at, revoked_at, created_at, updated_at
		FROM haptic_permissions
		WHERE owner_id = $1 AND controller_id = $2 AND match_id = $3
	`, ownerID, controllerID, matchID).Scan(
		&p.ID, &p.OwnerID, &p.ControllerID, &p.MatchID,
		&p.PermissionType, &p.MaxIntensity, &p.ExpiresAt,
		&p.GrantedAt, &p.RevokedAt, &p.CreatedAt, &p.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPermissionNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get permission: %w", err)
	}

	return &p, nil
}

// GetPermissionsForMatch gets all permissions for a match
func (s *Service) GetPermissionsForMatch(ctx context.Context, userID, matchID uuid.UUID) ([]models.HapticPermission, error) {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, owner_id, controller_id, match_id,
		       permission_type, max_intensity, expires_at,
		       granted_at, revoked_at, created_at, updated_at
		FROM haptic_permissions
		WHERE match_id = $1 AND (owner_id = $2 OR controller_id = $2)
	`, matchID, userID)
	if err != nil {
		return nil, fmt.Errorf("get match permissions: %w", err)
	}
	defer rows.Close()

	var perms []models.HapticPermission
	for rows.Next() {
		var p models.HapticPermission
		if err := rows.Scan(
			&p.ID, &p.OwnerID, &p.ControllerID, &p.MatchID,
			&p.PermissionType, &p.MaxIntensity, &p.ExpiresAt,
			&p.GrantedAt, &p.RevokedAt, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan permission: %w", err)
		}
		perms = append(perms, p)
	}

	return perms, nil
}

// RevokePermission revokes a haptic permission
func (s *Service) RevokePermission(ctx context.Context, ownerID, controllerID, matchID uuid.UUID) error {
	result, err := s.db.Pool.Exec(ctx, `
		UPDATE haptic_permissions SET revoked_at = NOW(), updated_at = NOW()
		WHERE owner_id = $1 AND controller_id = $2 AND match_id = $3 AND revoked_at IS NULL
	`, ownerID, controllerID, matchID)

	if err != nil {
		return fmt.Errorf("revoke permission: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrPermissionNotFound
	}

	log.Printf("[Haptic] Permission revoked: owner=%s, controller=%s", ownerID, controllerID)
	return nil
}

// ============================================================================
// Haptic Commands
// ============================================================================

// SendCommand sends a haptic command to another user's device
func (s *Service) SendCommand(ctx context.Context, senderID uuid.UUID, cmd *models.HapticCommand) error {
	// Verify users are matched
	if !s.areUsersMatched(ctx, senderID, cmd.TargetUserID, cmd.MatchID) {
		return ErrNotMatched
	}

	// Check permission
	perm, err := s.GetPermission(ctx, cmd.TargetUserID, senderID, cmd.MatchID)
	if err != nil && !errors.Is(err, ErrPermissionNotFound) {
		return err
	}

	allowed := false
	maxIntensity := 1.0

	if perm != nil && perm.IsActive() {
		switch perm.PermissionType {
		case models.PermissionTypeAlways:
			allowed = true
			maxIntensity = perm.MaxIntensity
		case models.PermissionTypeRequest:
			// Send permission request via WebSocket
			return s.sendPermissionRequest(ctx, senderID, cmd.TargetUserID, cmd.MatchID)
		case models.PermissionTypeNever:
			allowed = false
		}
	}

	// Log the command
	wasBlocked := !allowed
	s.logCommand(ctx, senderID, cmd, wasBlocked)

	if !allowed {
		return ErrPermissionDenied
	}

	// Clamp intensity to max allowed
	intensity := cmd.Intensity
	if intensity > maxIntensity {
		intensity = maxIntensity
	}

	// Get pattern data if this is a pattern command
	var patternData []models.PatternStep
	if cmd.CommandType == models.HapticCommandPattern && cmd.PatternID != nil {
		pattern, err := s.GetPattern(ctx, *cmd.PatternID)
		if err == nil {
			patternData = pattern.PatternData
		}
	}

	// Send command to target user via WebSocket
	response := &models.HapticCommandResponse{
		SenderID:    senderID,
		CommandType: cmd.CommandType,
		Intensity:   intensity,
		DurationMS:  cmd.DurationMS,
		MotorIndex:  cmd.MotorIndex,
		PatternData: patternData,
	}

	s.sendHapticCommand(cmd.TargetUserID, response)

	return nil
}

// ============================================================================
// Pattern Management
// ============================================================================

// GetPattern returns a haptic pattern
func (s *Service) GetPattern(ctx context.Context, patternID uuid.UUID) (*models.HapticPattern, error) {
	var p models.HapticPattern
	var patternDataJSON []byte

	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, creator_id, store_item_id, name, description,
		       is_public, pattern_data, duration_ms, use_count,
		       created_at, updated_at
		FROM haptic_patterns
		WHERE id = $1
	`, patternID).Scan(
		&p.ID, &p.CreatorID, &p.StoreItemID, &p.Name, &p.Description,
		&p.IsPublic, &patternDataJSON, &p.DurationMS, &p.UseCount,
		&p.CreatedAt, &p.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errors.New("pattern not found")
	}
	if err != nil {
		return nil, fmt.Errorf("get pattern: %w", err)
	}

	if err := json.Unmarshal(patternDataJSON, &p.PatternData); err != nil {
		return nil, fmt.Errorf("unmarshal pattern data: %w", err)
	}

	return &p, nil
}

// GetPublicPatterns returns public haptic patterns
func (s *Service) GetPublicPatterns(ctx context.Context, limit, offset int) ([]models.HapticPattern, error) {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, creator_id, store_item_id, name, description,
		       is_public, pattern_data, duration_ms, use_count,
		       created_at, updated_at
		FROM haptic_patterns
		WHERE is_public = true
		ORDER BY use_count DESC
		LIMIT $1 OFFSET $2
	`, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("get public patterns: %w", err)
	}
	defer rows.Close()

	var patterns []models.HapticPattern
	for rows.Next() {
		var p models.HapticPattern
		var patternDataJSON []byte
		if err := rows.Scan(
			&p.ID, &p.CreatorID, &p.StoreItemID, &p.Name, &p.Description,
			&p.IsPublic, &patternDataJSON, &p.DurationMS, &p.UseCount,
			&p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan pattern: %w", err)
		}
		json.Unmarshal(patternDataJSON, &p.PatternData)
		patterns = append(patterns, p)
	}

	return patterns, nil
}

// ============================================================================
// Helper Methods
// ============================================================================

func (s *Service) areUsersMatched(ctx context.Context, userA, userB, matchID uuid.UUID) bool {
	var exists bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM matches
			WHERE id = $1
			AND ((user_a = $2 AND user_b = $3) OR (user_a = $3 AND user_b = $2))
		)
	`, matchID, userA, userB).Scan(&exists)

	if err != nil {
		log.Printf("[Haptic] Error checking match: %v", err)
		return false
	}
	return exists
}

func (s *Service) logCommand(ctx context.Context, senderID uuid.UUID, cmd *models.HapticCommand, wasBlocked bool) {
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO haptic_command_log (
			id, sender_id, receiver_id, match_id,
			command_type, intensity, duration_ms,
			was_delivered, was_blocked, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, uuid.New(), senderID, cmd.TargetUserID, cmd.MatchID,
		cmd.CommandType, cmd.Intensity, cmd.DurationMS,
		!wasBlocked, wasBlocked, time.Now())

	if err != nil {
		log.Printf("[Haptic] Error logging command: %v", err)
	}
}

func (s *Service) sendPermissionRequest(ctx context.Context, requesterID, ownerID, matchID uuid.UUID) error {
	// Get requester name
	var requesterName string
	s.db.Pool.QueryRow(ctx, `SELECT COALESCE(display_name, 'Someone') FROM users WHERE id = $1`, requesterID).Scan(&requesterName)

	payload := &models.PermissionRequestPayload{
		RequestID:     uuid.New(),
		RequesterID:   requesterID,
		RequesterName: requesterName,
		MatchID:       matchID,
	}

	envelope, err := realtime.NewEnvelope(realtime.EventTypeHapticPermissionRequest, payload)
	if err != nil {
		return err
	}

	s.hub.SendToUser(ownerID, envelope)
	return nil
}

func (s *Service) sendHapticCommand(targetUserID uuid.UUID, response *models.HapticCommandResponse) {
	envelope, err := realtime.NewEnvelope(realtime.EventTypeHapticCommand, response)
	if err != nil {
		log.Printf("[Haptic] Error creating envelope: %v", err)
		return
	}

	s.hub.SendToUser(targetUserID, envelope)
}

func (s *Service) broadcastDeviceStatus(userID uuid.UUID, device *models.HapticDevice, connected bool) {
	payload := &models.DeviceStatusPayload{
		DeviceID:   device.ID,
		DeviceName: device.DeviceName,
		Connected:  connected,
	}

	envelope, err := realtime.NewEnvelope(realtime.EventTypeHapticDeviceStatus, payload)
	if err != nil {
		return
	}

	// Send to matched users
	matchedUserIDs := s.getMatchedUserIDs(context.Background(), userID)
	for _, matchedID := range matchedUserIDs {
		s.hub.SendToUser(matchedID, envelope)
	}
}

func (s *Service) getMatchedUserIDs(ctx context.Context, userID uuid.UUID) []uuid.UUID {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT CASE WHEN user_a = $1 THEN user_b ELSE user_a END
		FROM matches
		WHERE user_a = $1 OR user_b = $1
	`, userID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	return ids
}

func joinStrings(strs []string, sep string) string {
	if len(strs) == 0 {
		return ""
	}
	result := strs[0]
	for i := 1; i < len(strs); i++ {
		result += sep + strs[i]
	}
	return result
}
