package models

import (
	"time"

	"github.com/google/uuid"
)

// MessageType represents the type of message content
type MessageType string

const (
	MessageTypeText  MessageType = "text"
	MessageTypeImage MessageType = "image"
	MessageTypeGif   MessageType = "gif"
)

// Conversation represents a chat thread between matched users
type Conversation struct {
	ID            uuid.UUID  `json:"id"`
	MatchID       uuid.UUID  `json:"match_id"`       // Reference to the match
	UserAID       uuid.UUID  `json:"user_a_id"`      // Same ordering as match
	UserBID       uuid.UUID  `json:"user_b_id"`
	LastMessageAt *time.Time `json:"last_message_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// Message represents a single message in a conversation
type Message struct {
	ID             uuid.UUID   `json:"id"`
	ConversationID uuid.UUID   `json:"conversation_id"`
	SenderID       uuid.UUID   `json:"sender_id"`
	Type           MessageType `json:"type"`
	Content        string      `json:"content"`         // Text or media URL
	ReadAt         *time.Time  `json:"read_at,omitempty"`
	DeletedAt      *time.Time  `json:"-"`               // Soft delete
	CreatedAt      time.Time   `json:"created_at"`
}

// ConversationPreview represents a conversation in the list view
type ConversationPreview struct {
	ID            uuid.UUID         `json:"id"`
	MatchID       uuid.UUID         `json:"match_id"`
	OtherUser     UserPublicProfile `json:"other_user"`
	LastMessage   *MessagePreview   `json:"last_message,omitempty"`
	UnreadCount   int               `json:"unread_count"`
	LastMessageAt *time.Time        `json:"last_message_at,omitempty"`
}

// MessagePreview is a shortened message for list views
type MessagePreview struct {
	ID        uuid.UUID   `json:"id"`
	SenderID  uuid.UUID   `json:"sender_id"`
	Type      MessageType `json:"type"`
	Preview   string      `json:"preview"` // Truncated content
	CreatedAt time.Time   `json:"created_at"`
	IsRead    bool        `json:"is_read"`
}

// GetOtherUserID returns the ID of the other user in the conversation
func (c *Conversation) GetOtherUserID(myID uuid.UUID) uuid.UUID {
	if c.UserAID == myID {
		return c.UserBID
	}
	return c.UserAID
}

// TruncateContent returns truncated message content for previews
func (m *Message) TruncateContent(maxLen int) string {
	if m.Type != MessageTypeText {
		// For media, return type indicator
		switch m.Type {
		case MessageTypeImage:
			return "📷 Photo"
		case MessageTypeGif:
			return "🎬 GIF"
		default:
			return "📎 Media"
		}
	}

	if len(m.Content) <= maxLen {
		return m.Content
	}
	return m.Content[:maxLen-3] + "..."
}

// ToPreview converts a message to a preview format
func (m *Message) ToPreview(maxLen int) MessagePreview {
	return MessagePreview{
		ID:        m.ID,
		SenderID:  m.SenderID,
		Type:      m.Type,
		Preview:   m.TruncateContent(maxLen),
		CreatedAt: m.CreatedAt,
		IsRead:    m.ReadAt != nil,
	}
}
