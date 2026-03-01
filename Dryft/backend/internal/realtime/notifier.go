package realtime

import (
	"log"

	"github.com/google/uuid"
)

// Notifier provides methods for sending real-time notifications
// from other services (matching, chat, etc.)
type Notifier struct {
	hub *Hub
}

// NewNotifier creates a new notifier
func NewNotifier(hub *Hub) *Notifier {
	return &Notifier{hub: hub}
}

// NotifyNewMatch sends a match notification to both users
func (n *Notifier) NotifyNewMatch(matchID, conversationID uuid.UUID, userAID, userBID uuid.UUID, userAName, userBName string, userAPhoto, userBPhoto *string, matchedAt int64) {
	// Notify user A about user B
	payloadA := NewMatchPayload{
		MatchID:        matchID,
		ConversationID: conversationID,
		User: MatchUser{
			ID:          userBID,
			DisplayName: userBName,
			PhotoURL:    userBPhoto,
		},
		MatchedAt: matchedAt,
	}
	envelopeA, err := NewEnvelope(EventTypeNewMatch, payloadA)
	if err != nil {
		log.Printf("[Notifier] Error creating match envelope: %v", err)
		return
	}
	n.hub.SendToUser(userAID, envelopeA)

	// Notify user B about user A
	payloadB := NewMatchPayload{
		MatchID:        matchID,
		ConversationID: conversationID,
		User: MatchUser{
			ID:          userAID,
			DisplayName: userAName,
			PhotoURL:    userAPhoto,
		},
		MatchedAt: matchedAt,
	}
	envelopeB, err := NewEnvelope(EventTypeNewMatch, payloadB)
	if err != nil {
		log.Printf("[Notifier] Error creating match envelope: %v", err)
		return
	}
	n.hub.SendToUser(userBID, envelopeB)

	log.Printf("[Notifier] Match notification sent: match=%s, users=%s,%s", matchID, userAID, userBID)
}

// NotifyUnmatch sends unmatch notification to the other user
func (n *Notifier) NotifyUnmatch(matchID, conversationID uuid.UUID, notifyUserID uuid.UUID) {
	payload := UnmatchedPayload{
		MatchID:        matchID,
		ConversationID: conversationID,
	}
	envelope, err := NewEnvelope(EventTypeUnmatched, payload)
	if err != nil {
		log.Printf("[Notifier] Error creating unmatch envelope: %v", err)
		return
	}
	n.hub.SendToUser(notifyUserID, envelope)

	log.Printf("[Notifier] Unmatch notification sent: match=%s, user=%s", matchID, notifyUserID)
}

// NotifyNewMessage sends a new message notification to offline subscribers
// This is used when the recipient isn't subscribed to the conversation via WebSocket
func (n *Notifier) NotifyNewMessage(conversationID uuid.UUID, recipientID uuid.UUID, message NewMessagePayload) {
	envelope, err := NewEnvelope(EventTypeNewMessage, message)
	if err != nil {
		log.Printf("[Notifier] Error creating message envelope: %v", err)
		return
	}
	n.hub.SendToUser(recipientID, envelope)
}

// IsUserOnline checks if a user is currently connected
func (n *Notifier) IsUserOnline(userID uuid.UUID) bool {
	return n.hub.IsUserOnline(userID)
}

// GetPresence returns presence info for a user
func (n *Notifier) GetPresence(userID uuid.UUID) *PresenceInfo {
	return n.hub.GetUserPresence(userID)
}

// GetOnlineUsers returns which of the given users are online
func (n *Notifier) GetOnlineUsers(userIDs []uuid.UUID) map[uuid.UUID]bool {
	return n.hub.GetOnlineUsers(userIDs)
}
