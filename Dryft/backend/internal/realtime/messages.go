package realtime

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// EventType represents the type of real-time event
type EventType string

const (
	// Client -> Server events
	EventTypePing           EventType = "ping"
	EventTypeSubscribe      EventType = "subscribe"
	EventTypeUnsubscribe    EventType = "unsubscribe"
	EventTypeSendMessage    EventType = "send_message"
	EventTypeTypingStart    EventType = "typing_start"
	EventTypeTypingStop     EventType = "typing_stop"
	EventTypeMarkRead       EventType = "mark_read"

	// Server -> Client events
	EventTypePong           EventType = "pong"
	EventTypeError          EventType = "error"
	EventTypeNewMessage     EventType = "new_message"
	EventTypeMessageSent    EventType = "message_sent"
	EventTypeTypingIndicator EventType = "typing"
	EventTypePresenceUpdate EventType = "presence"
	EventTypeNewMatch       EventType = "new_match"
	EventTypeUnmatched      EventType = "unmatched"
	EventTypeMessagesRead   EventType = "messages_read"

	// Call signaling events (bidirectional)
	EventTypeCallRequest    EventType = "call_request"
	EventTypeCallAccept     EventType = "call_accept"
	EventTypeCallReject     EventType = "call_reject"
	EventTypeCallEnd        EventType = "call_end"
	EventTypeCallBusy       EventType = "call_busy"
	EventTypeCallOffer      EventType = "call_offer"
	EventTypeCallAnswer     EventType = "call_answer"
	EventTypeCallCandidate  EventType = "call_candidate"
	EventTypeCallMute       EventType = "call_mute"
	EventTypeCallUnmute     EventType = "call_unmute"
	EventTypeCallVideoOff   EventType = "call_video_off"
	EventTypeCallVideoOn    EventType = "call_video_on"

	// Haptic device events (bidirectional)
	EventTypeHapticCommand            EventType = "haptic_command"            // Send haptic command to user
	EventTypeHapticDeviceStatus       EventType = "haptic_device_status"      // Device connected/disconnected
	EventTypeHapticPermissionRequest  EventType = "haptic_permission_request"  // Request permission to control
	EventTypeHapticPermissionResponse EventType = "haptic_permission_response" // Response to permission request
	EventTypeHapticStop               EventType = "haptic_stop"               // Stop all haptic activity

	// Companion session events (VR <-> Mobile/Web)
	EventTypeSessionJoin       EventType = "session_join"        // Join a companion session
	EventTypeSessionLeave      EventType = "session_leave"       // Leave the session
	EventTypeSessionState      EventType = "session_state"       // VR user broadcasts state
	EventTypeSessionJoined     EventType = "session_joined"      // Confirmation of joining
	EventTypeSessionUserJoined EventType = "session_user_joined" // Another user joined
	EventTypeSessionUserLeft   EventType = "session_user_left"   // Another user left
	EventTypeSessionChat       EventType = "session_chat"        // Chat message in session
	EventTypeSessionHaptic     EventType = "session_haptic"      // Haptic command in session
	EventTypeSessionReaction   EventType = "session_reaction"    // React to VR user's action
	EventTypeSessionEnded      EventType = "session_ended"       // Session was ended by host

	// Voice chat events
	EventTypeVoiceJoin              EventType = "voice_join"               // Join voice channel
	EventTypeVoiceLeave             EventType = "voice_leave"              // Leave voice channel
	EventTypeVoiceJoined            EventType = "voice_joined"             // Confirmation of join
	EventTypeVoiceSpeaking          EventType = "voice_speaking"           // Speaking state change
	EventTypeVoiceParticipantJoined EventType = "voice_participant_joined" // Someone joined voice
	EventTypeVoiceParticipantLeft   EventType = "voice_participant_left"   // Someone left voice
	EventTypeVoiceMute              EventType = "voice_mute"               // Mute state change
	EventTypeVoiceError             EventType = "voice_error"              // Voice error

	// Avatar sync events
	EventTypeAvatarUpdate     EventType = "avatar_update"      // Avatar customization changed
	EventTypeAvatarEquip      EventType = "avatar_equip"       // Item equipped
	EventTypeAvatarUnequip    EventType = "avatar_unequip"     // Item unequipped
	EventTypeAvatarEmote      EventType = "avatar_emote"       // Emote triggered
	EventTypeAvatarColors     EventType = "avatar_colors"      // Color customization changed

	// Safety events
	EventTypeSafetyPanic      EventType = "safety_panic"       // Panic button activated
	EventTypeSafetyBlock      EventType = "safety_block"       // User blocked
	EventTypeSafetyUnblock    EventType = "safety_unblock"     // User unblocked
	EventTypeSafetyReport     EventType = "safety_report"      // User reported
	EventTypeSafetyWarning    EventType = "safety_warning"     // Warning from moderation

	// VR booth signaling events
	EventTypeBoothInvite         EventType = "booth_invite"
	EventTypeBoothInviteResponse EventType = "booth_invite_response"
	EventTypeBoothPrivacyUpdate  EventType = "booth_privacy_update"
	EventTypeBoothHostControl    EventType = "booth_host_control"
)

// Envelope wraps all WebSocket messages
type Envelope struct {
	Type      EventType       `json:"type"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	Timestamp int64           `json:"ts"`
}

// NewEnvelope creates a new message envelope
func NewEnvelope(eventType EventType, payload interface{}) (*Envelope, error) {
	var payloadBytes json.RawMessage
	if payload != nil {
		var err error
		payloadBytes, err = json.Marshal(payload)
		if err != nil {
			return nil, err
		}
	}

	return &Envelope{
		Type:      eventType,
		Payload:   payloadBytes,
		Timestamp: time.Now().UnixMilli(),
	}, nil
}

// --- Payload Types ---

// SubscribePayload for subscribing to a conversation
type SubscribePayload struct {
	ConversationID uuid.UUID `json:"conversation_id"`
}

// SendMessagePayload for sending a message
type SendMessagePayload struct {
	ConversationID uuid.UUID `json:"conversation_id"`
	Type           string    `json:"type"` // "text", "image", "gif"
	Content        string    `json:"content"`
	ClientID       string    `json:"client_id,omitempty"` // For deduplication
}

// TypingPayload for typing indicators
type TypingPayload struct {
	ConversationID uuid.UUID `json:"conversation_id"`
}

// MarkReadPayload for marking messages as read
type MarkReadPayload struct {
	ConversationID uuid.UUID `json:"conversation_id"`
}

// --- Server Response Payloads ---

// ErrorPayload for error responses
type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// NewMessagePayload for new message notifications
type NewMessagePayload struct {
	ID             uuid.UUID `json:"id"`
	ConversationID uuid.UUID `json:"conversation_id"`
	SenderID       uuid.UUID `json:"sender_id"`
	Type           string    `json:"type"`
	Content        string    `json:"content"`
	CreatedAt      int64     `json:"created_at"`
}

// MessageSentPayload confirms message was sent
type MessageSentPayload struct {
	ID             uuid.UUID `json:"id"`
	ConversationID uuid.UUID `json:"conversation_id"`
	ClientID       string    `json:"client_id,omitempty"`
	CreatedAt      int64     `json:"created_at"`
}

// TypingIndicatorPayload for typing status
type TypingIndicatorPayload struct {
	ConversationID uuid.UUID `json:"conversation_id"`
	UserID         uuid.UUID `json:"user_id"`
	IsTyping       bool      `json:"is_typing"`
}

// PresencePayload for online/offline status
type PresencePayload struct {
	UserID   uuid.UUID `json:"user_id"`
	IsOnline bool      `json:"is_online"`
	LastSeen *int64    `json:"last_seen,omitempty"`
}

// NewMatchPayload for match notifications
type NewMatchPayload struct {
	MatchID        uuid.UUID `json:"match_id"`
	ConversationID uuid.UUID `json:"conversation_id"`
	User           MatchUser `json:"user"`
	MatchedAt      int64     `json:"matched_at"`
}

// MatchUser is the matched user's basic info
type MatchUser struct {
	ID          uuid.UUID `json:"id"`
	DisplayName string    `json:"display_name"`
	PhotoURL    *string   `json:"photo_url,omitempty"`
}

// UnmatchedPayload for unmatch notifications
type UnmatchedPayload struct {
	MatchID        uuid.UUID `json:"match_id"`
	ConversationID uuid.UUID `json:"conversation_id"`
}

// MessagesReadPayload for read receipt notifications
type MessagesReadPayload struct {
	ConversationID uuid.UUID `json:"conversation_id"`
	ReaderID       uuid.UUID `json:"reader_id"`
	ReadAt         int64     `json:"read_at"`
}

// --- Call Signaling Payloads ---

// CallSignalPayload is the base payload for call signaling
type CallSignalPayload struct {
	CallID       string    `json:"call_id"`
	TargetUserID uuid.UUID `json:"target_user_id"`
	MatchID      uuid.UUID `json:"match_id,omitempty"`
	VideoEnabled bool      `json:"video_enabled,omitempty"`
	Reason       string    `json:"reason,omitempty"`
	// WebRTC SDP for offer/answer
	SDP json.RawMessage `json:"sdp,omitempty"`
	// ICE candidate
	Candidate json.RawMessage `json:"candidate,omitempty"`
}

// IncomingCallPayload sent to the callee
type IncomingCallPayload struct {
	CallID       string    `json:"call_id"`
	CallerID     uuid.UUID `json:"caller_id"`
	CallerName   string    `json:"caller_name"`
	CallerPhoto  *string   `json:"caller_photo,omitempty"`
	VideoEnabled bool      `json:"video_enabled"`
	MatchID      uuid.UUID `json:"match_id"`
}

// CallSDPPayload for SDP offer/answer
type CallSDPPayload struct {
	CallID string          `json:"call_id"`
	SDP    json.RawMessage `json:"sdp"`
}

// CallCandidatePayload for ICE candidates
type CallCandidatePayload struct {
	CallID    string          `json:"call_id"`
	Candidate json.RawMessage `json:"candidate"`
}

// CallStatusPayload for simple status updates
type CallStatusPayload struct {
	CallID string `json:"call_id"`
	Reason string `json:"reason,omitempty"`
}

// --- Companion Session Payloads ---

// SessionJoinPayload for joining a companion session
type SessionJoinPayload struct {
	SessionCode string `json:"session_code"` // 6-digit code
	DisplayName string `json:"display_name,omitempty"`
}

// SessionJoinedPayload confirms successful join
type SessionJoinedPayload struct {
	SessionID   uuid.UUID         `json:"session_id"`
	SessionCode string            `json:"session_code"`
	HostUser    SessionUser       `json:"host"`
	Participants []SessionUser    `json:"participants"`
	VRState     *VRStatePayload   `json:"vr_state,omitempty"`
}

// SessionUser represents a user in a companion session
type SessionUser struct {
	UserID      uuid.UUID `json:"user_id"`
	DisplayName string    `json:"display_name"`
	PhotoURL    *string   `json:"photo_url,omitempty"`
	IsHost      bool      `json:"is_host"`
	IsVR        bool      `json:"is_vr"`
	DeviceType  string    `json:"device_type"` // "vr", "mobile", "web"
	JoinedAt    int64     `json:"joined_at"`
}

// SessionUserJoinedPayload when a user joins
type SessionUserJoinedPayload struct {
	SessionID uuid.UUID   `json:"session_id"`
	User      SessionUser `json:"user"`
}

// SessionUserLeftPayload when a user leaves
type SessionUserLeftPayload struct {
	SessionID uuid.UUID `json:"session_id"`
	UserID    uuid.UUID `json:"user_id"`
	Reason    string    `json:"reason,omitempty"` // "left", "disconnected", "kicked"
}

// VRStatePayload represents VR user's current state
type VRStatePayload struct {
	SessionID    uuid.UUID `json:"session_id"`
	UserID       uuid.UUID `json:"user_id"`
	// Avatar state
	AvatarPosition  *Vector3 `json:"avatar_position,omitempty"`
	AvatarRotation  *Vector3 `json:"avatar_rotation,omitempty"`
	HeadPosition    *Vector3 `json:"head_position,omitempty"`
	LeftHandPos     *Vector3 `json:"left_hand_pos,omitempty"`
	RightHandPos    *Vector3 `json:"right_hand_pos,omitempty"`
	// Status
	CurrentActivity string  `json:"current_activity,omitempty"` // "idle", "dancing", "interacting"
	CurrentRoom     string  `json:"current_room,omitempty"`     // "lounge", "booth"
	// Device status
	HapticDeviceConnected bool    `json:"haptic_device_connected"`
	HapticDeviceName      string  `json:"haptic_device_name,omitempty"`
	HapticIntensity       float64 `json:"haptic_intensity,omitempty"` // Current intensity 0-1
}

// Vector3 for position/rotation data
type Vector3 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// SessionChatPayload for chat messages in session
type SessionChatPayload struct {
	SessionID uuid.UUID `json:"session_id"`
	UserID    uuid.UUID `json:"user_id,omitempty"`    // Set by server
	DisplayName string  `json:"display_name,omitempty"` // Set by server
	Content   string    `json:"content"`
	Timestamp int64     `json:"timestamp,omitempty"`   // Set by server
}

// SessionHapticPayload for haptic commands in session
type SessionHapticPayload struct {
	SessionID    uuid.UUID `json:"session_id"`
	FromUserID   uuid.UUID `json:"from_user_id,omitempty"` // Set by server
	ToUserID     uuid.UUID `json:"to_user_id"`             // Target user
	CommandType  string    `json:"command_type"`           // "vibrate", "pattern", "stop"
	Intensity    float64   `json:"intensity,omitempty"`    // 0-1
	DurationMs   int       `json:"duration_ms,omitempty"`
	PatternName  string    `json:"pattern_name,omitempty"`
}

// SessionReactionPayload for reactions
type SessionReactionPayload struct {
	SessionID  uuid.UUID `json:"session_id"`
	UserID     uuid.UUID `json:"user_id,omitempty"` // Set by server
	ReactionType string  `json:"reaction_type"`     // "heart", "fire", "wink", etc.
}

// SessionEndedPayload when session ends
type SessionEndedPayload struct {
	SessionID uuid.UUID `json:"session_id"`
	Reason    string    `json:"reason"` // "host_ended", "expired", "all_left"
}

// --- Voice Chat Payloads ---

// VoiceJoinPayload for joining voice channel
type VoiceJoinPayload struct {
	SessionID uuid.UUID `json:"session_id"`
}

// VoiceJoinedPayload confirms voice join
type VoiceJoinedPayload struct {
	SessionID    uuid.UUID          `json:"session_id"`
	Participants []VoiceParticipant `json:"participants"`
}

// VoiceParticipant in a voice channel
type VoiceParticipant struct {
	UserID      uuid.UUID `json:"user_id"`
	DisplayName string    `json:"display_name"`
	IsSpeaking  bool      `json:"is_speaking"`
	IsMuted     bool      `json:"is_muted"`
	JoinedAt    int64     `json:"joined_at"`
}

// VoiceSpeakingPayload for speaking state
type VoiceSpeakingPayload struct {
	SessionID uuid.UUID `json:"session_id"`
	UserID    uuid.UUID `json:"user_id,omitempty"` // Set by server
	Speaking  bool      `json:"speaking"`
}

// VoiceParticipantJoinedPayload when someone joins voice
type VoiceParticipantJoinedPayload struct {
	SessionID   uuid.UUID `json:"session_id"`
	UserID      uuid.UUID `json:"user_id"`
	DisplayName string    `json:"display_name"`
}

// VoiceParticipantLeftPayload when someone leaves voice
type VoiceParticipantLeftPayload struct {
	SessionID uuid.UUID `json:"session_id"`
	UserID    uuid.UUID `json:"user_id"`
}

// VoiceMutePayload for mute state
type VoiceMutePayload struct {
	SessionID uuid.UUID `json:"session_id"`
	UserID    uuid.UUID `json:"user_id,omitempty"` // Set by server
	Muted     bool      `json:"muted"`
}

// VoiceErrorPayload for voice errors
type VoiceErrorPayload struct {
	SessionID uuid.UUID `json:"session_id,omitempty"`
	Error     string    `json:"error"`
	Code      string    `json:"code,omitempty"`
}

// --- Avatar Sync Payloads ---

// AvatarUpdatePayload for full avatar state
type AvatarUpdatePayload struct {
	UserID          uuid.UUID `json:"user_id,omitempty"` // Set by server for remote
	EquippedAvatar  string    `json:"equipped_avatar_id,omitempty"`
	EquippedOutfit  string    `json:"equipped_outfit_id,omitempty"`
	EquippedEffect  string    `json:"equipped_effect_id,omitempty"`
	SkinTone        string    `json:"skin_tone,omitempty"`  // Hex color
	HairColor       string    `json:"hair_color,omitempty"` // Hex color
	EyeColor        string    `json:"eye_color,omitempty"`  // Hex color
	DisplayName     string    `json:"display_name,omitempty"`
	IsVisible       bool      `json:"is_visible"`
}

// AvatarEquipPayload for equipping an item
type AvatarEquipPayload struct {
	UserID   uuid.UUID `json:"user_id,omitempty"` // Set by server
	ItemID   string    `json:"item_id"`
	ItemType string    `json:"item_type"` // "avatar", "outfit", "effect"
}

// AvatarUnequipPayload for unequipping an item
type AvatarUnequipPayload struct {
	UserID   uuid.UUID `json:"user_id,omitempty"` // Set by server
	ItemType string    `json:"item_type"`
}

// AvatarEmotePayload for emotes
type AvatarEmotePayload struct {
	UserID  uuid.UUID `json:"user_id,omitempty"` // Set by server
	EmoteID int       `json:"emote_id"`
}

// AvatarColorsPayload for color customization
type AvatarColorsPayload struct {
	UserID    uuid.UUID `json:"user_id,omitempty"` // Set by server
	SkinTone  string    `json:"skin_tone,omitempty"`
	HairColor string    `json:"hair_color,omitempty"`
	EyeColor  string    `json:"eye_color,omitempty"`
}

// --- Safety Payloads ---

// SafetyPanicPayload for panic button
type SafetyPanicPayload struct {
	UserID    uuid.UUID `json:"user_id"`
	SessionID uuid.UUID `json:"session_id,omitempty"`
	Location  string    `json:"location,omitempty"` // "booth", "lounge", etc.
	Timestamp int64     `json:"timestamp"`
}

// SafetyBlockPayload for blocking a user
type SafetyBlockPayload struct {
	BlockedUserID uuid.UUID `json:"blocked_user_id"`
	Reason        string    `json:"reason,omitempty"`
}

// SafetyUnblockPayload for unblocking
type SafetyUnblockPayload struct {
	UnblockedUserID uuid.UUID `json:"unblocked_user_id"`
}

// SafetyReportPayload for reporting a user
type SafetyReportPayload struct {
	ReportedUserID uuid.UUID `json:"reported_user_id"`
	Category       string    `json:"category"` // "harassment", "inappropriate", "spam", "other"
	Reason         string    `json:"reason"`
	Description    string    `json:"description,omitempty"`
	EvidenceURLs   []string  `json:"evidence_urls,omitempty"`
	SessionID      uuid.UUID `json:"session_id,omitempty"`
}

// SafetyReportResponse from server
type SafetyReportResponse struct {
	ReportID string `json:"report_id"`
	Status   string `json:"status"` // "received", "reviewing", "resolved"
	Message  string `json:"message"`
}

// SafetyWarningPayload from moderation
type SafetyWarningPayload struct {
	UserID   uuid.UUID `json:"user_id"`
	Type     string    `json:"type"`    // "warning", "strike", "suspension"
	Reason   string    `json:"reason"`
	Message  string    `json:"message"`
	ExpiresAt *int64   `json:"expires_at,omitempty"`
}

// --- Booth Signaling Payloads ---

type BoothInvitePayload struct {
	BoothID   string `json:"booth_id"`
	InviterID string `json:"inviter_id"`
	InviteeID string `json:"invitee_id"`
}

type BoothInviteResponsePayload struct {
	BoothID   string `json:"booth_id"`
	InviterID string `json:"inviter_id"`
	InviteeID string `json:"invitee_id"`
	Accepted  bool   `json:"accepted"`
}

type BoothPrivacyUpdatePayload struct {
	BoothID               string `json:"booth_id"`
	InviteOnly            bool   `json:"invite_only"`
	RoomLocked            bool   `json:"room_locked"`
	CompanionVoiceAllowed bool   `json:"companion_voice_allowed"`
	MaxGuestCount         int    `json:"max_guest_count"`
	HostID                string `json:"host_id,omitempty"`
}

type BoothHostControlPayload struct {
	BoothID string `json:"booth_id"`
	HostID  string `json:"host_id"`
	Action  string `json:"action"` // "lock_room", "unlock_room", "toggle_invite_only", "toggle_companion_voice", "end_party"
}

type BoothDisconnectPayload struct {
	BoothID string `json:"booth_id"`
	Reason  string `json:"reason"`
}
