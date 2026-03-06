package chat

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/dryft-app/backend/internal/database"
	"github.com/dryft-app/backend/internal/models"
)

var (
	ErrConversationNotFound = errors.New("conversation not found")
	ErrNotInConversation    = errors.New("you are not part of this conversation")
	ErrMessageNotFound      = errors.New("message not found")
	ErrEmptyMessage         = errors.New("message content cannot be empty")
	ErrMatchUnmatched       = errors.New("cannot send message to unmatched user")
	ErrInvalidUserID        = errors.New("invalid user id")
	ErrInvalidConversation  = errors.New("invalid conversation id")
	ErrInvalidMessageType   = errors.New("invalid message type")
)

// ChatNotifier interface for sending chat notifications
type ChatNotifier interface {
	NotifyNewMessage(ctx context.Context, userID uuid.UUID, senderName, messagePreview string, matchID uuid.UUID) error
}

// Service handles chat business logic
type Service struct {
	db       *database.DB
	notifier ChatNotifier
}

// NewService creates a new chat service
func NewService(db *database.DB, notifier ChatNotifier) *Service {
	return &Service{
		db:       db,
		notifier: notifier,
	}
}

// DB returns the database connection (for realtime signaling)
func (s *Service) DB() *database.DB {
	return s.db
}

// GetConversations returns all conversations for a user
func (s *Service) GetConversations(ctx context.Context, userID uuid.UUID, limit, offset int) ([]models.ConversationPreview, error) {
	if userID == uuid.Nil {
		return nil, ErrInvalidUserID
	}

	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	// Single query with LATERAL join to fetch last message in one round-trip (avoids N+1)
	rows, err := s.db.Pool.Query(ctx, `
		SELECT
			c.id, c.match_id, c.last_message_at,
			u.id, u.display_name, u.bio, u.profile_photo, u.verified,
			(
				SELECT COUNT(*)
				FROM messages m
				WHERE m.conversation_id = c.id
					AND m.sender_id != $1
					AND m.read_at IS NULL
					AND m.deleted_at IS NULL
			) as unread_count,
			lm.id, lm.sender_id, lm.type, lm.content, lm.read_at, lm.created_at
		FROM conversations c
		JOIN matches match ON c.match_id = match.id
		JOIN users u ON (
			(c.user_a_id = $1 AND u.id = c.user_b_id) OR
			(c.user_b_id = $1 AND u.id = c.user_a_id)
		)
		LEFT JOIN LATERAL (
			SELECT id, sender_id, type, content, read_at, created_at
			FROM messages
			WHERE conversation_id = c.id AND deleted_at IS NULL
			ORDER BY created_at DESC
			LIMIT 1
		) lm ON true
		WHERE (c.user_a_id = $1 OR c.user_b_id = $1)
			AND match.unmatched_at IS NULL
			AND u.deleted_at IS NULL
		ORDER BY c.last_message_at DESC NULLS LAST
		LIMIT $2 OFFSET $3
	`, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("query conversations: %w", err)
	}
	defer rows.Close()

	var conversations []models.ConversationPreview
	for rows.Next() {
		var c models.ConversationPreview
		var displayName, bio, profilePhoto *string
		var lastMsgID, lastMsgSenderID *uuid.UUID
		var lastMsgType, lastMsgContent *string
		var lastMsgReadAt, lastMsgCreatedAt *time.Time

		err := rows.Scan(
			&c.ID, &c.MatchID, &c.LastMessageAt,
			&c.OtherUser.ID, &displayName, &bio, &profilePhoto, &c.OtherUser.Verified,
			&c.UnreadCount,
			&lastMsgID, &lastMsgSenderID, &lastMsgType, &lastMsgContent, &lastMsgReadAt, &lastMsgCreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan conversation: %w", err)
		}

		c.OtherUser.DisplayName = displayName
		c.OtherUser.Bio = bio
		c.OtherUser.ProfilePhoto = profilePhoto

		// Build last message preview if exists
		if lastMsgID != nil && lastMsgContent != nil {
			msg := models.Message{
				ID:             *lastMsgID,
				ConversationID: c.ID,
				SenderID:       *lastMsgSenderID,
				Type:           models.MessageType(*lastMsgType),
				Content:        *lastMsgContent,
				ReadAt:         lastMsgReadAt,
				CreatedAt:      *lastMsgCreatedAt,
			}
			preview := msg.ToPreview(50)
			c.LastMessage = &preview
		}

		conversations = append(conversations, c)
	}

	return conversations, nil
}

// GetConversation returns a specific conversation
func (s *Service) GetConversation(ctx context.Context, userID, conversationID uuid.UUID) (*models.ConversationPreview, error) {
	if userID == uuid.Nil {
		return nil, ErrInvalidUserID
	}
	if conversationID == uuid.Nil {
		return nil, ErrInvalidConversation
	}

	var c models.ConversationPreview
	var displayName, bio, profilePhoto *string

	err := s.db.Pool.QueryRow(ctx, `
		SELECT
			c.id, c.match_id, c.last_message_at,
			u.id, u.display_name, u.bio, u.profile_photo, u.verified,
			(
				SELECT COUNT(*)
				FROM messages m
				WHERE m.conversation_id = c.id
					AND m.sender_id != $1
					AND m.read_at IS NULL
					AND m.deleted_at IS NULL
			) as unread_count
		FROM conversations c
		JOIN matches match ON c.match_id = match.id
		JOIN users u ON (
			(c.user_a_id = $1 AND u.id = c.user_b_id) OR
			(c.user_b_id = $1 AND u.id = c.user_a_id)
		)
		WHERE c.id = $2
			AND (c.user_a_id = $1 OR c.user_b_id = $1)
			AND u.deleted_at IS NULL
	`, userID, conversationID).Scan(
		&c.ID, &c.MatchID, &c.LastMessageAt,
		&c.OtherUser.ID, &displayName, &bio, &profilePhoto, &c.OtherUser.Verified,
		&c.UnreadCount,
	)

	if err == pgx.ErrNoRows {
		return nil, ErrConversationNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("query conversation: %w", err)
	}

	c.OtherUser.DisplayName = displayName
	c.OtherUser.Bio = bio
	c.OtherUser.ProfilePhoto = profilePhoto

	return &c, nil
}

// GetMessages returns messages in a conversation
func (s *Service) GetMessages(ctx context.Context, userID, conversationID uuid.UUID, limit, offset int) ([]models.Message, error) {
	if userID == uuid.Nil {
		return nil, ErrInvalidUserID
	}
	if conversationID == uuid.Nil {
		return nil, ErrInvalidConversation
	}

	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	// Verify user is in conversation
	var inConversation bool
	err := s.db.Pool.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM conversations WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2))",
		conversationID, userID,
	).Scan(&inConversation)
	if err != nil {
		return nil, fmt.Errorf("check conversation access: %w", err)
	}
	if !inConversation {
		return nil, ErrNotInConversation
	}

	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, conversation_id, sender_id, type, content, read_at, created_at
		FROM messages
		WHERE conversation_id = $1
			AND deleted_at IS NULL
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, conversationID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("query messages: %w", err)
	}
	defer rows.Close()

	var messages []models.Message
	for rows.Next() {
		var m models.Message
		err := rows.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.Type, &m.Content, &m.ReadAt, &m.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan message: %w", err)
		}
		messages = append(messages, m)
	}

	return messages, nil
}

// SendMessage sends a message in a conversation
func (s *Service) SendMessage(ctx context.Context, userID, conversationID uuid.UUID, msgType models.MessageType, content string) (*models.Message, error) {
	if userID == uuid.Nil {
		return nil, ErrInvalidUserID
	}
	if conversationID == uuid.Nil {
		return nil, ErrInvalidConversation
	}
	if !isValidMessageType(msgType) {
		return nil, ErrInvalidMessageType
	}
	if strings.TrimSpace(content) == "" {
		return nil, ErrEmptyMessage
	}

	// Verify user is in conversation and match is active
	var inConversation bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM conversations c
			JOIN matches m ON c.match_id = m.id
			WHERE c.id = $1
				AND (c.user_a_id = $2 OR c.user_b_id = $2)
				AND m.unmatched_at IS NULL
		)
	`, conversationID, userID).Scan(&inConversation)
	if err != nil {
		return nil, fmt.Errorf("check conversation access: %w", err)
	}
	if !inConversation {
		// Check if unmatched
		var unmatched bool
		s.db.Pool.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM conversations c
				JOIN matches m ON c.match_id = m.id
				WHERE c.id = $1
					AND (c.user_a_id = $2 OR c.user_b_id = $2)
					AND m.unmatched_at IS NOT NULL
			)
		`, conversationID, userID).Scan(&unmatched)
		if unmatched {
			return nil, ErrMatchUnmatched
		}
		return nil, ErrNotInConversation
	}

	var msg models.Message
	err = s.db.Pool.QueryRow(ctx, `
		INSERT INTO messages (conversation_id, sender_id, type, content)
		VALUES ($1, $2, $3, $4)
		RETURNING id, conversation_id, sender_id, type, content, read_at, created_at
	`, conversationID, userID, msgType, content).Scan(
		&msg.ID, &msg.ConversationID, &msg.SenderID, &msg.Type, &msg.Content, &msg.ReadAt, &msg.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert message: %w", err)
	}

	// Update last_message_at in conversation
	s.db.Pool.Exec(ctx, `
		UPDATE conversations SET last_message_at = $1 WHERE id = $2
	`, msg.CreatedAt, conversationID)

	// Send notification to recipient (async, don't fail the message send)
	if s.notifier != nil {
		go s.sendMessageNotification(ctx, userID, conversationID, content)
	}

	return &msg, nil
}

// sendMessageNotification sends a push notification for a new message
func (s *Service) sendMessageNotification(ctx context.Context, senderID, conversationID uuid.UUID, content string) {
	// Get recipient ID and match ID
	var recipientID, matchID uuid.UUID
	err := s.db.Pool.QueryRow(ctx, `
		SELECT
			CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END,
			match_id
		FROM conversations
		WHERE id = $2
	`, senderID, conversationID).Scan(&recipientID, &matchID)
	if err != nil {
		return
	}

	// Get sender's display name
	var senderName string
	s.db.Pool.QueryRow(ctx,
		"SELECT COALESCE(display_name, 'Someone') FROM users WHERE id = $1",
		senderID,
	).Scan(&senderName)
	if senderName == "" {
		senderName = "Someone"
	}

	// Send the notification
	s.notifier.NotifyNewMessage(ctx, recipientID, senderName, content, matchID)
}

// MarkAsRead marks messages as read
func (s *Service) MarkAsRead(ctx context.Context, userID, conversationID uuid.UUID) error {
	if userID == uuid.Nil {
		return ErrInvalidUserID
	}
	if conversationID == uuid.Nil {
		return ErrInvalidConversation
	}

	// Verify user is in conversation
	var inConversation bool
	err := s.db.Pool.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM conversations WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2))",
		conversationID, userID,
	).Scan(&inConversation)
	if err != nil {
		return fmt.Errorf("check conversation access: %w", err)
	}
	if !inConversation {
		return ErrNotInConversation
	}

	// Mark all unread messages from the other user as read
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE messages
		SET read_at = $1
		WHERE conversation_id = $2
			AND sender_id != $3
			AND read_at IS NULL
			AND deleted_at IS NULL
	`, time.Now(), conversationID, userID)
	if err != nil {
		return fmt.Errorf("mark as read: %w", err)
	}

	return nil
}

// GetConversationByMatch returns a conversation for a match
func (s *Service) GetConversationByMatch(ctx context.Context, userID, matchID uuid.UUID) (*models.ConversationPreview, error) {
	if userID == uuid.Nil {
		return nil, ErrInvalidUserID
	}
	if matchID == uuid.Nil {
		return nil, ErrConversationNotFound
	}

	var conversationID uuid.UUID
	err := s.db.Pool.QueryRow(ctx, `
		SELECT c.id
		FROM conversations c
		JOIN matches m ON c.match_id = m.id
		WHERE m.id = $1
			AND (m.user_a = $2 OR m.user_b = $2)
	`, matchID, userID).Scan(&conversationID)

	if err == pgx.ErrNoRows {
		return nil, ErrConversationNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("query conversation by match: %w", err)
	}

	return s.GetConversation(ctx, userID, conversationID)
}

// Helper to get the last message in a conversation
func (s *Service) getLastMessage(ctx context.Context, conversationID uuid.UUID) (*models.Message, error) {
	var m models.Message
	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, conversation_id, sender_id, type, content, read_at, created_at
		FROM messages
		WHERE conversation_id = $1
			AND deleted_at IS NULL
		ORDER BY created_at DESC
		LIMIT 1
	`, conversationID).Scan(
		&m.ID, &m.ConversationID, &m.SenderID, &m.Type, &m.Content, &m.ReadAt, &m.CreatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func isValidMessageType(msgType models.MessageType) bool {
	switch msgType {
	case models.MessageTypeText, models.MessageTypeImage, models.MessageTypeGif:
		return true
	default:
		return false
	}
}
