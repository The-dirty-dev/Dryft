package session

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/dryft-app/backend/internal/models"
	"github.com/dryft-app/backend/internal/realtime"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrSessionNotFound    = errors.New("session not found")
	ErrSessionExpired     = errors.New("session has expired")
	ErrSessionFull        = errors.New("session is full")
	ErrAlreadyInSession   = errors.New("already in session")
	ErrNotInSession       = errors.New("not in session")
	ErrNotSessionHost     = errors.New("not session host")
	ErrInvalidSessionCode = errors.New("invalid session code")
	ErrPermissionDenied   = errors.New("permission denied")
)

// Service handles companion session operations
type Service struct {
	db  *pgxpool.Pool
	hub *realtime.Hub
}

// NewService creates a new session service
func NewService(db *pgxpool.Pool, hub *realtime.Hub) *Service {
	return &Service{db: db, hub: hub}
}

// CreateSession creates a new companion session
func (s *Service) CreateSession(ctx context.Context, hostID uuid.UUID, req models.CreateSessionRequest) (*models.CreateSessionResponse, error) {
	// Generate unique 6-digit code
	code, err := s.generateUniqueCode(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to generate session code: %w", err)
	}

	// Default expiration: 60 minutes
	expiresIn := 60
	if req.ExpiresInMins > 0 && req.ExpiresInMins <= 480 { // Max 8 hours
		expiresIn = req.ExpiresInMins
	}

	maxParticipants := 5
	if req.MaxParticipants > 0 && req.MaxParticipants <= 10 {
		maxParticipants = req.MaxParticipants
	}

	expiresAt := time.Now().Add(time.Duration(expiresIn) * time.Minute)

	// Create session
	var sessionID uuid.UUID
	err = s.db.QueryRow(ctx, `
		INSERT INTO companion_sessions (host_id, session_code, max_participants, vr_device_type, expires_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, hostID, code, maxParticipants, req.VRDeviceType, expiresAt).Scan(&sessionID)

	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	// Get host display name
	var displayName string
	err = s.db.QueryRow(ctx, `SELECT display_name FROM users WHERE id = $1`, hostID).Scan(&displayName)
	if err != nil {
		displayName = "Host"
	}

	// Add host as participant
	_, err = s.db.Exec(ctx, `
		INSERT INTO session_participants (session_id, user_id, display_name, device_type, is_host)
		VALUES ($1, $2, $3, $4, TRUE)
	`, sessionID, hostID, displayName, models.DeviceTypeVR)

	if err != nil {
		return nil, fmt.Errorf("failed to add host as participant: %w", err)
	}

	return &models.CreateSessionResponse{
		SessionID:   sessionID,
		SessionCode: code,
		ExpiresAt:   expiresAt,
	}, nil
}

// JoinSession joins an existing session by code
func (s *Service) JoinSession(ctx context.Context, userID uuid.UUID, req models.JoinSessionRequest) (*models.SessionInfo, error) {
	// Find session by code
	var session models.CompanionSession
	err := s.db.QueryRow(ctx, `
		SELECT id, host_id, session_code, status, max_participants, vr_device_type, vr_room, created_at, expires_at, ended_at
		FROM companion_sessions
		WHERE session_code = $1 AND status = 'active' AND expires_at > NOW()
	`, req.SessionCode).Scan(
		&session.ID, &session.HostID, &session.SessionCode, &session.Status,
		&session.MaxParticipants, &session.VRDeviceType, &session.VRRoom,
		&session.CreatedAt, &session.ExpiresAt, &session.EndedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidSessionCode
		}
		return nil, fmt.Errorf("failed to find session: %w", err)
	}

	// Check if session is expired
	if session.ExpiresAt.Before(time.Now()) {
		return nil, ErrSessionExpired
	}

	// Check participant count
	var count int
	err = s.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM session_participants
		WHERE session_id = $1 AND left_at IS NULL
	`, session.ID).Scan(&count)

	if err != nil {
		return nil, fmt.Errorf("failed to count participants: %w", err)
	}

	if count >= session.MaxParticipants {
		return nil, ErrSessionFull
	}

	// Check if already in session
	var existingID uuid.UUID
	err = s.db.QueryRow(ctx, `
		SELECT id FROM session_participants
		WHERE session_id = $1 AND user_id = $2 AND left_at IS NULL
	`, session.ID, userID).Scan(&existingID)

	if err == nil {
		return nil, ErrAlreadyInSession
	}

	// Get display name
	displayName := req.DisplayName
	if displayName == "" {
		_ = s.db.QueryRow(ctx, `SELECT display_name FROM users WHERE id = $1`, userID).Scan(&displayName)
		if displayName == "" {
			displayName = "Guest"
		}
	}

	// Add participant
	_, err = s.db.Exec(ctx, `
		INSERT INTO session_participants (session_id, user_id, display_name, device_type, is_host)
		VALUES ($1, $2, $3, $4, FALSE)
		ON CONFLICT (session_id, user_id) DO UPDATE SET left_at = NULL, joined_at = NOW()
	`, session.ID, userID, displayName, req.DeviceType)

	if err != nil {
		return nil, fmt.Errorf("failed to join session: %w", err)
	}

	// Get session info
	sessionInfo, err := s.GetSessionInfo(ctx, session.ID, userID)
	if err != nil {
		return nil, err
	}

	// Broadcast user joined to other participants
	s.broadcastUserJoined(session.ID, userID, displayName, req.DeviceType)

	return sessionInfo, nil
}

// LeaveSession removes a user from a session
func (s *Service) LeaveSession(ctx context.Context, sessionID, userID uuid.UUID) error {
	// Mark participant as left
	result, err := s.db.Exec(ctx, `
		UPDATE session_participants SET left_at = NOW()
		WHERE session_id = $1 AND user_id = $2 AND left_at IS NULL
	`, sessionID, userID)

	if err != nil {
		return fmt.Errorf("failed to leave session: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNotInSession
	}

	// Broadcast user left
	s.broadcastUserLeft(sessionID, userID, "left")

	// Check if host left
	var hostLeft bool
	err = s.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM session_participants
			WHERE session_id = $1 AND user_id = $2 AND is_host = TRUE
		)
	`, sessionID, userID).Scan(&hostLeft)

	if err == nil && hostLeft {
		return s.EndSession(ctx, sessionID, userID)
	}

	return nil
}

// EndSession ends a session (host only)
func (s *Service) EndSession(ctx context.Context, sessionID, userID uuid.UUID) error {
	// Update session status
	result, err := s.db.Exec(ctx, `
		UPDATE companion_sessions
		SET status = 'ended', ended_at = NOW()
		WHERE id = $1 AND (host_id = $2 OR $2 = '00000000-0000-0000-0000-000000000000')
		AND status = 'active'
	`, sessionID, userID)

	if err != nil {
		return fmt.Errorf("failed to end session: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNotSessionHost
	}

	// Mark all participants as left
	_, _ = s.db.Exec(ctx, `
		UPDATE session_participants SET left_at = NOW()
		WHERE session_id = $1 AND left_at IS NULL
	`, sessionID)

	// Broadcast session ended
	s.broadcastSessionEnded(sessionID, "host_ended")

	return nil
}

// GetSessionInfo returns full session details
func (s *Service) GetSessionInfo(ctx context.Context, sessionID, userID uuid.UUID) (*models.SessionInfo, error) {
	// Get session
	var session models.CompanionSession
	err := s.db.QueryRow(ctx, `
		SELECT id, host_id, session_code, status, max_participants, vr_device_type, vr_room, created_at, expires_at, ended_at
		FROM companion_sessions WHERE id = $1
	`, sessionID).Scan(
		&session.ID, &session.HostID, &session.SessionCode, &session.Status,
		&session.MaxParticipants, &session.VRDeviceType, &session.VRRoom,
		&session.CreatedAt, &session.ExpiresAt, &session.EndedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	// Get participants with user info
	rows, err := s.db.Query(ctx, `
		SELECT sp.user_id, sp.display_name, sp.device_type, sp.is_host, sp.joined_at, u.primary_photo_url
		FROM session_participants sp
		JOIN users u ON sp.user_id = u.id
		WHERE sp.session_id = $1 AND sp.left_at IS NULL
		ORDER BY sp.joined_at
	`, sessionID)

	if err != nil {
		return nil, fmt.Errorf("failed to get participants: %w", err)
	}
	defer rows.Close()

	info := &models.SessionInfo{
		Session:      session,
		Participants: make([]models.ParticipantInfo, 0),
	}

	for rows.Next() {
		var pi models.ParticipantInfo
		err := rows.Scan(&pi.UserID, &pi.DisplayName, &pi.DeviceType, &pi.IsHost, &pi.JoinedAt, &pi.PhotoURL)
		if err != nil {
			return nil, fmt.Errorf("failed to scan participant: %w", err)
		}

		if pi.IsHost {
			info.Host = pi
		}
		info.Participants = append(info.Participants, pi)
	}

	return info, nil
}

// SetHapticPermission sets haptic control permission
func (s *Service) SetHapticPermission(ctx context.Context, sessionID, ownerID uuid.UUID, req models.SetHapticPermissionRequest) error {
	maxIntensity := req.MaxIntensity
	if maxIntensity <= 0 || maxIntensity > 1 {
		maxIntensity = 1.0
	}

	_, err := s.db.Exec(ctx, `
		INSERT INTO session_haptic_permissions (session_id, owner_id, controller_id, permission_type, max_intensity)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (session_id, owner_id, controller_id)
		DO UPDATE SET permission_type = $4, max_intensity = $5
	`, sessionID, ownerID, req.ControllerID, req.PermissionType, maxIntensity)

	return err
}

// CheckHapticPermission checks if a user can send haptics to another
func (s *Service) CheckHapticPermission(ctx context.Context, sessionID, controllerID, targetID uuid.UUID) (bool, float64, error) {
	var permissionType models.PermissionType
	var maxIntensity float64

	err := s.db.QueryRow(ctx, `
		SELECT permission_type, max_intensity FROM session_haptic_permissions
		WHERE session_id = $1 AND owner_id = $2 AND controller_id = $3
	`, sessionID, targetID, controllerID).Scan(&permissionType, &maxIntensity)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// No explicit permission - default to request
			return false, 1.0, nil
		}
		return false, 0, err
	}

	return permissionType == models.PermissionTypeAlways, maxIntensity, nil
}

// SendSessionChat sends a chat message
func (s *Service) SendSessionChat(ctx context.Context, sessionID, senderID uuid.UUID, content string) error {
	// Save message
	_, err := s.db.Exec(ctx, `
		INSERT INTO session_messages (session_id, sender_id, content, message_type)
		VALUES ($1, $2, $3, 'text')
	`, sessionID, senderID, content)

	if err != nil {
		return fmt.Errorf("failed to save message: %w", err)
	}

	// Get sender display name
	var displayName string
	_ = s.db.QueryRow(ctx, `
		SELECT display_name FROM session_participants
		WHERE session_id = $1 AND user_id = $2
	`, sessionID, senderID).Scan(&displayName)

	// Broadcast to session
	s.broadcastSessionChat(sessionID, senderID, displayName, content)

	return nil
}

// BroadcastVRState broadcasts VR user state to companions
func (s *Service) BroadcastVRState(ctx context.Context, sessionID uuid.UUID, state *realtime.VRStatePayload) error {
	envelope, err := realtime.NewEnvelope(realtime.EventTypeSessionState, state)
	if err != nil {
		return err
	}

	// Get all participants except the sender
	rows, err := s.db.Query(ctx, `
		SELECT user_id FROM session_participants
		WHERE session_id = $1 AND left_at IS NULL AND user_id != $2
	`, sessionID, state.UserID)

	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var userID uuid.UUID
		if err := rows.Scan(&userID); err != nil {
			continue
		}
		s.hub.SendToUser(userID, envelope)
	}

	return nil
}

// --- Helper Methods ---

func (s *Service) generateUniqueCode(ctx context.Context) (string, error) {
	const charset = "0123456789"
	const codeLen = 6

	for attempts := 0; attempts < 10; attempts++ {
		code := make([]byte, codeLen)
		for i := range code {
			n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
			if err != nil {
				return "", err
			}
			code[i] = charset[n.Int64()]
		}

		codeStr := string(code)

		// Check if code already exists
		var exists bool
		err := s.db.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM companion_sessions
				WHERE session_code = $1 AND status = 'active'
			)
		`, codeStr).Scan(&exists)

		if err != nil {
			return "", err
		}

		if !exists {
			return codeStr, nil
		}
	}

	return "", errors.New("failed to generate unique code after 10 attempts")
}

func (s *Service) broadcastUserJoined(sessionID, userID uuid.UUID, displayName string, deviceType models.DeviceType) {
	payload := realtime.SessionUserJoinedPayload{
		SessionID: sessionID,
		User: realtime.SessionUser{
			UserID:      userID,
			DisplayName: displayName,
			IsHost:      false,
			IsVR:        deviceType == models.DeviceTypeVR,
			DeviceType:  string(deviceType),
			JoinedAt:    time.Now().UnixMilli(),
		},
	}

	envelope, _ := realtime.NewEnvelope(realtime.EventTypeSessionUserJoined, payload)
	s.broadcastToSession(sessionID, envelope, &userID)
}

func (s *Service) broadcastUserLeft(sessionID, userID uuid.UUID, reason string) {
	payload := realtime.SessionUserLeftPayload{
		SessionID: sessionID,
		UserID:    userID,
		Reason:    reason,
	}

	envelope, _ := realtime.NewEnvelope(realtime.EventTypeSessionUserLeft, payload)
	s.broadcastToSession(sessionID, envelope, nil)
}

func (s *Service) broadcastSessionEnded(sessionID uuid.UUID, reason string) {
	payload := realtime.SessionEndedPayload{
		SessionID: sessionID,
		Reason:    reason,
	}

	envelope, _ := realtime.NewEnvelope(realtime.EventTypeSessionEnded, payload)
	s.broadcastToSession(sessionID, envelope, nil)
}

func (s *Service) broadcastSessionChat(sessionID, senderID uuid.UUID, displayName, content string) {
	payload := realtime.SessionChatPayload{
		SessionID:   sessionID,
		UserID:      senderID,
		DisplayName: displayName,
		Content:     content,
		Timestamp:   time.Now().UnixMilli(),
	}

	envelope, _ := realtime.NewEnvelope(realtime.EventTypeSessionChat, payload)
	s.broadcastToSession(sessionID, envelope, nil)
}

func (s *Service) broadcastToSession(sessionID uuid.UUID, envelope *realtime.Envelope, excludeUserID *uuid.UUID) {
	ctx := context.Background()

	rows, err := s.db.Query(ctx, `
		SELECT user_id FROM session_participants
		WHERE session_id = $1 AND left_at IS NULL
	`, sessionID)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var userID uuid.UUID
		if err := rows.Scan(&userID); err != nil {
			continue
		}
		if excludeUserID != nil && userID == *excludeUserID {
			continue
		}
		s.hub.SendToUser(userID, envelope)
	}
}

// GetUserActiveSession gets user's current active session
func (s *Service) GetUserActiveSession(ctx context.Context, userID uuid.UUID) (*models.CompanionSession, error) {
	var session models.CompanionSession
	err := s.db.QueryRow(ctx, `
		SELECT cs.id, cs.host_id, cs.session_code, cs.status, cs.max_participants,
		       cs.vr_device_type, cs.vr_room, cs.created_at, cs.expires_at, cs.ended_at
		FROM companion_sessions cs
		JOIN session_participants sp ON cs.id = sp.session_id
		WHERE sp.user_id = $1 AND sp.left_at IS NULL AND cs.status = 'active'
		ORDER BY sp.joined_at DESC
		LIMIT 1
	`, userID).Scan(
		&session.ID, &session.HostID, &session.SessionCode, &session.Status,
		&session.MaxParticipants, &session.VRDeviceType, &session.VRRoom,
		&session.CreatedAt, &session.ExpiresAt, &session.EndedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return &session, nil
}
