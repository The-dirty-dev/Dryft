package realtime

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/metrics"
)

// PresenceFilter determines which users should receive presence updates
// for a given user. Implementations should return the set of user IDs
// that are allowed to see this user's online status (e.g., matched users).
type PresenceFilter interface {
	GetPresenceRecipients(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error)
}

// Hub maintains active WebSocket connections and broadcasts messages
type Hub struct {
	// Registered clients by user ID
	clients map[uuid.UUID]map[*Client]bool

	// Conversation subscriptions: conversationID -> set of clients
	conversations map[uuid.UUID]map[*Client]bool

	// User presence tracking
	presence map[uuid.UUID]*PresenceInfo

	// Channels for client registration/unregistration
	register   chan *Client
	unregister chan *Client

	// Channel for broadcasting to specific users
	userBroadcast chan *UserMessage

	// Channel for broadcasting to conversation subscribers
	convBroadcast chan *ConversationMessage

	// Mutex for thread-safe operations
	mu sync.RWMutex

	// Optional filter to restrict presence broadcasts to matched users
	presenceFilter PresenceFilter
}

// PresenceInfo tracks user online status
type PresenceInfo struct {
	IsOnline    bool
	LastSeen    time.Time
	Connections int
}

// UserMessage is a message targeted at a specific user
type UserMessage struct {
	UserID  uuid.UUID
	Message *Envelope
}

// ConversationMessage is a message for all subscribers of a conversation
type ConversationMessage struct {
	ConversationID uuid.UUID
	Message        *Envelope
	ExcludeClient  *Client // Optional: exclude sender from broadcast
}

// NewHub creates a new Hub instance
func NewHub() *Hub {
	return &Hub{
		clients:       make(map[uuid.UUID]map[*Client]bool),
		conversations: make(map[uuid.UUID]map[*Client]bool),
		presence:      make(map[uuid.UUID]*PresenceInfo),
		register:      make(chan *Client),
		unregister:    make(chan *Client),
		userBroadcast: make(chan *UserMessage, 256),
		convBroadcast: make(chan *ConversationMessage, 256),
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case msg := <-h.userBroadcast:
			h.broadcastToUser(msg.UserID, msg.Message)

		case msg := <-h.convBroadcast:
			h.broadcastToConversation(msg.ConversationID, msg.Message, msg.ExcludeClient)
		}
	}
}

func (h *Hub) registerClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Add to user's client set
	if h.clients[client.UserID] == nil {
		h.clients[client.UserID] = make(map[*Client]bool)
	}
	h.clients[client.UserID][client] = true

	// Update presence
	if h.presence[client.UserID] == nil {
		h.presence[client.UserID] = &PresenceInfo{}
	}
	h.presence[client.UserID].IsOnline = true
	h.presence[client.UserID].Connections++

	log.Printf("[Hub] Client registered: user=%s, connections=%d",
		client.UserID, h.presence[client.UserID].Connections)

	// Record metrics
	metrics.RecordWebSocketConnect()
	metrics.SetActiveUsers(float64(len(h.clients)))

	// Broadcast presence update to relevant users
	go h.broadcastPresenceChange(client.UserID, true)
}

func (h *Hub) unregisterClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Remove from user's client set
	if clients, ok := h.clients[client.UserID]; ok {
		delete(clients, client)
		if len(clients) == 0 {
			delete(h.clients, client.UserID)
		}
	}

	// Remove from all conversation subscriptions
	for convID, subscribers := range h.conversations {
		delete(subscribers, client)
		if len(subscribers) == 0 {
			delete(h.conversations, convID)
		}
	}

	// Update presence
	if info, ok := h.presence[client.UserID]; ok {
		info.Connections--
		if info.Connections <= 0 {
			info.IsOnline = false
			info.LastSeen = time.Now()
			info.Connections = 0
		}
	}

	// Close the client's send channel
	close(client.send)

	// Record metrics
	metrics.RecordWebSocketDisconnect()
	metrics.SetActiveUsers(float64(len(h.clients)))

	log.Printf("[Hub] Client unregistered: user=%s", client.UserID)

	// Broadcast presence update if user is now offline
	if h.presence[client.UserID] != nil && !h.presence[client.UserID].IsOnline {
		go h.broadcastPresenceChange(client.UserID, false)
	}
}

// Subscribe adds a client to a conversation's subscriber list
func (h *Hub) Subscribe(client *Client, conversationID uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.conversations[conversationID] == nil {
		h.conversations[conversationID] = make(map[*Client]bool)
	}
	h.conversations[conversationID][client] = true
	client.subscriptions[conversationID] = true

	log.Printf("[Hub] Client subscribed: user=%s, conversation=%s",
		client.UserID, conversationID)
}

// Unsubscribe removes a client from a conversation's subscriber list
func (h *Hub) Unsubscribe(client *Client, conversationID uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if subscribers, ok := h.conversations[conversationID]; ok {
		delete(subscribers, client)
		if len(subscribers) == 0 {
			delete(h.conversations, conversationID)
		}
	}
	delete(client.subscriptions, conversationID)

	log.Printf("[Hub] Client unsubscribed: user=%s, conversation=%s",
		client.UserID, conversationID)
}

// SendToUser sends a message to all connections of a specific user
func (h *Hub) SendToUser(userID uuid.UUID, envelope *Envelope) {
	h.userBroadcast <- &UserMessage{
		UserID:  userID,
		Message: envelope,
	}
}

// SendToConversation sends a message to all subscribers of a conversation
func (h *Hub) SendToConversation(conversationID uuid.UUID, envelope *Envelope, exclude *Client) {
	h.convBroadcast <- &ConversationMessage{
		ConversationID: conversationID,
		Message:        envelope,
		ExcludeClient:  exclude,
	}
}

func (h *Hub) broadcastToUser(userID uuid.UUID, envelope *Envelope) {
	h.mu.RLock()
	clients := h.clients[userID]
	h.mu.RUnlock()

	for client := range clients {
		select {
		case client.send <- envelope:
		default:
			// Client's send buffer is full, skip
			log.Printf("[Hub] Dropping message for slow client: user=%s", userID)
		}
	}
}

func (h *Hub) broadcastToConversation(conversationID uuid.UUID, envelope *Envelope, exclude *Client) {
	h.mu.RLock()
	subscribers := h.conversations[conversationID]
	h.mu.RUnlock()

	for client := range subscribers {
		if client == exclude {
			continue
		}
		select {
		case client.send <- envelope:
		default:
			log.Printf("[Hub] Dropping message for slow client: user=%s", client.UserID)
		}
	}
}

func (h *Hub) broadcastPresenceChange(userID uuid.UUID, isOnline bool) {
	h.mu.RLock()
	presence := h.presence[userID]
	h.mu.RUnlock()

	payload := PresencePayload{
		UserID:   userID,
		IsOnline: isOnline,
	}
	if presence != nil && !isOnline {
		lastSeen := presence.LastSeen.UnixMilli()
		payload.LastSeen = &lastSeen
	}

	envelope, err := NewEnvelope(EventTypePresenceUpdate, payload)
	if err != nil {
		log.Printf("[Hub] Error creating presence envelope: %v", err)
		return
	}

	// If a presence filter is configured, only send to matched/allowed users
	if h.presenceFilter != nil {
		recipients, err := h.presenceFilter.GetPresenceRecipients(context.Background(), userID)
		if err != nil {
			log.Printf("[Hub] Error getting presence recipients for user=%s: %v", userID, err)
			return
		}

		h.mu.RLock()
		for _, recipientID := range recipients {
			if clients, ok := h.clients[recipientID]; ok {
				for client := range clients {
					select {
					case client.send <- envelope:
					default:
					}
				}
			}
		}
		h.mu.RUnlock()
		return
	}

	// Fallback: broadcast to all connected clients (no filter configured)
	h.mu.RLock()
	for _, clients := range h.clients {
		for client := range clients {
			if client.UserID == userID {
				continue // Don't send to self
			}
			select {
			case client.send <- envelope:
			default:
			}
		}
	}
	h.mu.RUnlock()
}

// SetPresenceFilter sets the filter used to determine which users receive presence updates
func (h *Hub) SetPresenceFilter(filter PresenceFilter) {
	h.presenceFilter = filter
}

// IsUserOnline checks if a user has any active connections
func (h *Hub) IsUserOnline(userID uuid.UUID) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if info, ok := h.presence[userID]; ok {
		return info.IsOnline
	}
	return false
}

// GetUserPresence returns presence info for a user
func (h *Hub) GetUserPresence(userID uuid.UUID) *PresenceInfo {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if info, ok := h.presence[userID]; ok {
		return &PresenceInfo{
			IsOnline:    info.IsOnline,
			LastSeen:    info.LastSeen,
			Connections: info.Connections,
		}
	}
	return nil
}

// GetOnlineUsers returns a list of online user IDs
func (h *Hub) GetOnlineUsers(userIDs []uuid.UUID) map[uuid.UUID]bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	result := make(map[uuid.UUID]bool)
	for _, id := range userIDs {
		if info, ok := h.presence[id]; ok && info.IsOnline {
			result[id] = true
		}
	}
	return result
}
