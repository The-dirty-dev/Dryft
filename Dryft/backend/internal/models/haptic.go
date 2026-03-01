package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// HapticDevice represents a user's connected haptic device from Intiface/Buttplug
type HapticDevice struct {
	ID            uuid.UUID  `json:"id"`
	UserID        uuid.UUID  `json:"user_id"`

	// Device identification
	DeviceIndex   int        `json:"device_index"`    // Buttplug session index
	DeviceName    string     `json:"device_name"`
	DeviceAddress *string    `json:"device_address,omitempty"` // Bluetooth address

	// Capabilities
	CanVibrate    bool       `json:"can_vibrate"`
	CanRotate     bool       `json:"can_rotate"`
	CanLinear     bool       `json:"can_linear"`
	CanBattery    bool       `json:"can_battery"`
	VibrateCount  int        `json:"vibrate_count"`
	RotateCount   int        `json:"rotate_count"`
	LinearCount   int        `json:"linear_count"`

	// User preferences
	DisplayName   *string    `json:"display_name,omitempty"`
	IsPrimary     bool       `json:"is_primary"`
	MaxIntensity  float64    `json:"max_intensity"`

	// Status
	LastConnected *time.Time `json:"last_connected,omitempty"`

	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// HapticDevicePublic is the public view of a device (excludes sensitive info)
type HapticDevicePublic struct {
	ID           uuid.UUID `json:"id"`
	DeviceName   string    `json:"device_name"`
	DisplayName  *string   `json:"display_name,omitempty"`
	CanVibrate   bool      `json:"can_vibrate"`
	CanRotate    bool      `json:"can_rotate"`
	CanLinear    bool      `json:"can_linear"`
	IsPrimary    bool      `json:"is_primary"`
}

// ToPublic converts a HapticDevice to its public representation
func (d *HapticDevice) ToPublic() HapticDevicePublic {
	return HapticDevicePublic{
		ID:          d.ID,
		DeviceName:  d.DeviceName,
		DisplayName: d.DisplayName,
		CanVibrate:  d.CanVibrate,
		CanRotate:   d.CanRotate,
		CanLinear:   d.CanLinear,
		IsPrimary:   d.IsPrimary,
	}
}

// PermissionType defines the type of haptic permission
type PermissionType string

const (
	PermissionTypeAlways  PermissionType = "always"  // Always allow without prompting
	PermissionTypeRequest PermissionType = "request" // Prompt each time
	PermissionTypeNever   PermissionType = "never"   // Always block
)

// HapticPermission represents permission for one user to control another's devices
type HapticPermission struct {
	ID             uuid.UUID      `json:"id"`
	OwnerID        uuid.UUID      `json:"owner_id"`      // Device owner
	ControllerID   uuid.UUID      `json:"controller_id"` // Who can control
	MatchID        uuid.UUID      `json:"match_id"`

	PermissionType PermissionType `json:"permission_type"`
	MaxIntensity   float64        `json:"max_intensity"`
	ExpiresAt      *time.Time     `json:"expires_at,omitempty"`

	GrantedAt      time.Time      `json:"granted_at"`
	RevokedAt      *time.Time     `json:"revoked_at,omitempty"`

	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

// IsActive checks if the permission is currently active
func (p *HapticPermission) IsActive() bool {
	if p.RevokedAt != nil {
		return false
	}
	if p.ExpiresAt != nil && p.ExpiresAt.Before(time.Now()) {
		return false
	}
	return true
}

// HapticCommandType represents types of haptic commands
type HapticCommandType string

const (
	HapticCommandVibrate HapticCommandType = "vibrate"
	HapticCommandRotate  HapticCommandType = "rotate"
	HapticCommandLinear  HapticCommandType = "linear"
	HapticCommandStop    HapticCommandType = "stop"
	HapticCommandPattern HapticCommandType = "pattern"
)

// HapticCommandLog records haptic commands for safety auditing
type HapticCommandLog struct {
	ID           uuid.UUID         `json:"id"`
	SenderID     uuid.UUID         `json:"sender_id"`
	ReceiverID   uuid.UUID         `json:"receiver_id"`
	MatchID      uuid.UUID         `json:"match_id"`
	CallID       *uuid.UUID        `json:"call_id,omitempty"`

	CommandType  HapticCommandType `json:"command_type"`
	Intensity    *float64          `json:"intensity,omitempty"`
	DurationMS   *int              `json:"duration_ms,omitempty"`
	Pattern      *string           `json:"pattern,omitempty"`

	WasDelivered bool              `json:"was_delivered"`
	WasBlocked   bool              `json:"was_blocked"`

	CreatedAt    time.Time         `json:"created_at"`
}

// PatternStep represents a single step in a haptic pattern
type PatternStep struct {
	TimeMS     int     `json:"time_ms"`     // Time offset from pattern start
	Intensity  float64 `json:"intensity"`   // 0-1
	MotorIndex int     `json:"motor_index"` // Which motor (0 for all)
}

// HapticPattern represents a saved haptic pattern
type HapticPattern struct {
	ID          uuid.UUID     `json:"id"`
	CreatorID   *uuid.UUID    `json:"creator_id,omitempty"`
	StoreItemID *uuid.UUID    `json:"store_item_id,omitempty"`

	Name        string        `json:"name"`
	Description *string       `json:"description,omitempty"`
	IsPublic    bool          `json:"is_public"`

	PatternData []PatternStep `json:"pattern_data"`
	DurationMS  int           `json:"duration_ms"`

	UseCount    int           `json:"use_count"`

	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

// --- Request/Response types ---

// RegisterDeviceRequest is sent when a device connects via Intiface
type RegisterDeviceRequest struct {
	DeviceIndex   int     `json:"device_index" validate:"required,min=0"`
	DeviceName    string  `json:"device_name" validate:"required"`
	DeviceAddress *string `json:"device_address,omitempty"`

	CanVibrate    bool    `json:"can_vibrate"`
	CanRotate     bool    `json:"can_rotate"`
	CanLinear     bool    `json:"can_linear"`
	CanBattery    bool    `json:"can_battery"`
	VibrateCount  int     `json:"vibrate_count"`
	RotateCount   int     `json:"rotate_count"`
	LinearCount   int     `json:"linear_count"`
}

// UpdateDeviceRequest for updating device preferences
type UpdateDeviceRequest struct {
	DisplayName  *string  `json:"display_name,omitempty"`
	IsPrimary    *bool    `json:"is_primary,omitempty"`
	MaxIntensity *float64 `json:"max_intensity,omitempty" validate:"omitempty,min=0,max=1"`
}

// SetPermissionRequest for granting/updating haptic permissions
type SetPermissionRequest struct {
	ControllerID   uuid.UUID      `json:"controller_id" validate:"required"`
	MatchID        uuid.UUID      `json:"match_id" validate:"required"`
	PermissionType PermissionType `json:"permission_type" validate:"required,oneof=always request never"`
	MaxIntensity   *float64       `json:"max_intensity,omitempty" validate:"omitempty,min=0,max=1"`
	DurationMins   *int           `json:"duration_mins,omitempty"` // NULL = permanent
}

// HapticCommand is sent to control another user's device
type HapticCommand struct {
	TargetUserID uuid.UUID         `json:"target_user_id" validate:"required"`
	MatchID      uuid.UUID         `json:"match_id" validate:"required"`
	DeviceID     *uuid.UUID        `json:"device_id,omitempty"` // Specific device or all

	CommandType  HapticCommandType `json:"command_type" validate:"required"`
	Intensity    float64           `json:"intensity" validate:"min=0,max=1"`
	DurationMS   int               `json:"duration_ms" validate:"min=0,max=30000"`
	MotorIndex   *int              `json:"motor_index,omitempty"` // Specific motor or all

	PatternID    *uuid.UUID        `json:"pattern_id,omitempty"` // For pattern commands
}

// HapticCommandResponse is sent to the target device
type HapticCommandResponse struct {
	SenderID    uuid.UUID         `json:"sender_id"`
	CommandType HapticCommandType `json:"command_type"`
	Intensity   float64           `json:"intensity"`
	DurationMS  int               `json:"duration_ms"`
	MotorIndex  *int              `json:"motor_index,omitempty"`
	PatternData []PatternStep     `json:"pattern_data,omitempty"`
}

// PermissionRequestPayload sent when someone wants to control your device
type PermissionRequestPayload struct {
	RequestID    uuid.UUID `json:"request_id"`
	RequesterID  uuid.UUID `json:"requester_id"`
	RequesterName string   `json:"requester_name"`
	MatchID      uuid.UUID `json:"match_id"`
}

// PermissionResponsePayload sent in response to a permission request
type PermissionResponsePayload struct {
	RequestID uuid.UUID `json:"request_id"`
	Granted   bool      `json:"granted"`
}

// DeviceStatusPayload for device connect/disconnect events
type DeviceStatusPayload struct {
	DeviceID   uuid.UUID `json:"device_id"`
	DeviceName string    `json:"device_name"`
	Connected  bool      `json:"connected"`
	Battery    *int      `json:"battery,omitempty"` // Battery percentage if available
}

// MarshalPatternData converts pattern data to JSON for storage
func (p *HapticPattern) MarshalPatternData() (json.RawMessage, error) {
	return json.Marshal(p.PatternData)
}

// UnmarshalPatternData parses pattern data from JSON
func (p *HapticPattern) UnmarshalPatternData(data json.RawMessage) error {
	return json.Unmarshal(data, &p.PatternData)
}
