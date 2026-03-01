package models

import (
	"time"

	"github.com/google/uuid"
)

// SessionStatus represents the status of a companion session
type SessionStatus string

const (
	SessionStatusActive  SessionStatus = "active"
	SessionStatusEnded   SessionStatus = "ended"
	SessionStatusExpired SessionStatus = "expired"
)

// DeviceType represents the type of device a participant is using
type DeviceType string

const (
	DeviceTypeVR     DeviceType = "vr"
	DeviceTypeMobile DeviceType = "mobile"
	DeviceTypeWeb    DeviceType = "web"
)

// CompanionSession represents a session where mobile/web users can interact with VR users
type CompanionSession struct {
	ID              uuid.UUID     `json:"id" db:"id"`
	HostID          uuid.UUID     `json:"host_id" db:"host_id"`
	SessionCode     string        `json:"session_code" db:"session_code"`
	Status          SessionStatus `json:"status" db:"status"`
	MaxParticipants int           `json:"max_participants" db:"max_participants"`

	// VR state
	VRDeviceType string `json:"vr_device_type,omitempty" db:"vr_device_type"`
	VRRoom       string `json:"vr_room,omitempty" db:"vr_room"`

	// Timestamps
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	ExpiresAt time.Time  `json:"expires_at" db:"expires_at"`
	EndedAt   *time.Time `json:"ended_at,omitempty" db:"ended_at"`
}

// SessionParticipant represents a user in a companion session
type SessionParticipant struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	SessionID   uuid.UUID  `json:"session_id" db:"session_id"`
	UserID      uuid.UUID  `json:"user_id" db:"user_id"`
	DisplayName string     `json:"display_name" db:"display_name"`
	DeviceType  DeviceType `json:"device_type" db:"device_type"`
	IsHost      bool       `json:"is_host" db:"is_host"`
	JoinedAt    time.Time  `json:"joined_at" db:"joined_at"`
	LeftAt      *time.Time `json:"left_at,omitempty" db:"left_at"`
}

// SessionHapticPermission controls who can send haptic commands to whom
type SessionHapticPermission struct {
	ID             uuid.UUID      `json:"id" db:"id"`
	SessionID      uuid.UUID      `json:"session_id" db:"session_id"`
	OwnerID        uuid.UUID      `json:"owner_id" db:"owner_id"`
	ControllerID   uuid.UUID      `json:"controller_id" db:"controller_id"`
	PermissionType PermissionType `json:"permission_type" db:"permission_type"`
	MaxIntensity   float64        `json:"max_intensity" db:"max_intensity"`
	CreatedAt      time.Time      `json:"created_at" db:"created_at"`
}

// SessionMessage represents a chat message in a session
type SessionMessage struct {
	ID          uuid.UUID `json:"id" db:"id"`
	SessionID   uuid.UUID `json:"session_id" db:"session_id"`
	SenderID    uuid.UUID `json:"sender_id" db:"sender_id"`
	Content     string    `json:"content" db:"content"`
	MessageType string    `json:"message_type" db:"message_type"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// --- Request/Response Types ---

// CreateSessionRequest for creating a new companion session
type CreateSessionRequest struct {
	MaxParticipants int    `json:"max_participants,omitempty"`
	VRDeviceType    string `json:"vr_device_type,omitempty"`
	ExpiresInMins   int    `json:"expires_in_mins,omitempty"` // Default 60 mins
}

// CreateSessionResponse returned when creating a session
type CreateSessionResponse struct {
	SessionID   uuid.UUID `json:"session_id"`
	SessionCode string    `json:"session_code"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// JoinSessionRequest for joining a session
type JoinSessionRequest struct {
	SessionCode string     `json:"session_code"`
	DisplayName string     `json:"display_name,omitempty"`
	DeviceType  DeviceType `json:"device_type"`
}

// SessionInfo contains full session details
type SessionInfo struct {
	Session      CompanionSession      `json:"session"`
	Participants []ParticipantInfo     `json:"participants"`
	Host         ParticipantInfo       `json:"host"`
}

// ParticipantInfo contains participant details with user info
type ParticipantInfo struct {
	UserID      uuid.UUID  `json:"user_id"`
	DisplayName string     `json:"display_name"`
	PhotoURL    *string    `json:"photo_url,omitempty"`
	DeviceType  DeviceType `json:"device_type"`
	IsHost      bool       `json:"is_host"`
	JoinedAt    time.Time  `json:"joined_at"`
}

// SetHapticPermissionRequest for setting haptic permissions
type SetHapticPermissionRequest struct {
	ControllerID   uuid.UUID      `json:"controller_id"`
	PermissionType PermissionType `json:"permission_type"`
	MaxIntensity   float64        `json:"max_intensity,omitempty"`
}

// SessionChatRequest for sending chat in session
type SessionChatRequest struct {
	Content string `json:"content"`
}

// SessionHapticRequest for sending haptic commands
type SessionHapticRequest struct {
	ToUserID    uuid.UUID `json:"to_user_id"`
	CommandType string    `json:"command_type"` // vibrate, pattern, stop
	Intensity   float64   `json:"intensity,omitempty"`
	DurationMs  int       `json:"duration_ms,omitempty"`
	PatternName string    `json:"pattern_name,omitempty"`
}
