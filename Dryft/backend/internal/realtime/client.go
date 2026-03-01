package realtime

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/dryft-app/backend/internal/chat"
	"github.com/dryft-app/backend/internal/models"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 4096

	// Send buffer size
	sendBufferSize = 256
)

// Client represents a single WebSocket connection
type Client struct {
	hub  *Hub
	conn *websocket.Conn

	// User info
	UserID   uuid.UUID
	Email    string
	Verified bool

	// Subscribed conversations
	subscriptions map[uuid.UUID]bool

	// Outbound messages
	send chan *Envelope

	// Chat service for message operations
	chatService *chat.Service

	// Call notifier for push notifications
	callNotifier CallNotifier

	// Typing state
	typingConversation *uuid.UUID
	typingTimer        *time.Timer
}

// NewClient creates a new WebSocket client
func NewClient(hub *Hub, conn *websocket.Conn, userID uuid.UUID, email string, verified bool, chatService *chat.Service, callNotifier CallNotifier) *Client {
	return &Client{
		hub:           hub,
		conn:          conn,
		UserID:        userID,
		Email:         email,
		Verified:      verified,
		subscriptions: make(map[uuid.UUID]bool),
		send:          make(chan *Envelope, sendBufferSize),
		chatService:   chatService,
		callNotifier:  callNotifier,
	}
}

// ReadPump pumps messages from the WebSocket connection to the hub
func (c *Client) ReadPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[Client] Read error: %v", err)
			}
			break
		}

		// Parse envelope
		var envelope Envelope
		if err := json.Unmarshal(message, &envelope); err != nil {
			c.sendError("invalid_message", "Failed to parse message")
			continue
		}

		// Handle message
		c.handleMessage(&envelope)
	}
}

// WritePump pumps messages from the hub to the WebSocket connection
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case envelope, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteJSON(envelope); err != nil {
				log.Printf("[Client] Write error: %v", err)
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleMessage(envelope *Envelope) {
	switch envelope.Type {
	case EventTypePing:
		c.handlePing()

	case EventTypeSubscribe:
		c.handleSubscribe(envelope.Payload)

	case EventTypeUnsubscribe:
		c.handleUnsubscribe(envelope.Payload)

	case EventTypeSendMessage:
		c.handleSendMessage(envelope.Payload)

	case EventTypeTypingStart:
		c.handleTypingStart(envelope.Payload)

	case EventTypeTypingStop:
		c.handleTypingStop(envelope.Payload)

	case EventTypeMarkRead:
		c.handleMarkRead(envelope.Payload)

	// Call signaling events - relay to target user
	case EventTypeCallRequest:
		c.handleCallRequest(envelope.Payload)

	case EventTypeCallAccept, EventTypeCallReject, EventTypeCallEnd,
		EventTypeCallOffer, EventTypeCallAnswer, EventTypeCallCandidate,
		EventTypeCallMute, EventTypeCallUnmute, EventTypeCallVideoOff, EventTypeCallVideoOn:
		c.handleCallSignal(envelope.Type, envelope.Payload)

	default:
		c.sendError("unknown_event", "Unknown event type")
	}
}

func (c *Client) handlePing() {
	envelope, _ := NewEnvelope(EventTypePong, nil)
	c.send <- envelope
}

func (c *Client) handleSubscribe(payload json.RawMessage) {
	var sub SubscribePayload
	if err := json.Unmarshal(payload, &sub); err != nil {
		c.sendError("invalid_payload", "Invalid subscribe payload")
		return
	}

	// Verify user has access to this conversation
	ctx := context.Background()
	_, err := c.chatService.GetConversation(ctx, c.UserID, sub.ConversationID)
	if err != nil {
		c.sendError("access_denied", "Cannot access this conversation")
		return
	}

	c.hub.Subscribe(c, sub.ConversationID)
}

func (c *Client) handleUnsubscribe(payload json.RawMessage) {
	var sub SubscribePayload
	if err := json.Unmarshal(payload, &sub); err != nil {
		c.sendError("invalid_payload", "Invalid unsubscribe payload")
		return
	}

	c.hub.Unsubscribe(c, sub.ConversationID)
}

func (c *Client) handleSendMessage(payload json.RawMessage) {
	var msg SendMessagePayload
	if err := json.Unmarshal(payload, &msg); err != nil {
		c.sendError("invalid_payload", "Invalid message payload")
		return
	}

	// Validate message type
	var msgType models.MessageType
	switch msg.Type {
	case "text", "":
		msgType = models.MessageTypeText
	case "image":
		msgType = models.MessageTypeImage
	case "gif":
		msgType = models.MessageTypeGif
	default:
		c.sendError("invalid_type", "Invalid message type")
		return
	}

	// Send message via chat service
	ctx := context.Background()
	message, err := c.chatService.SendMessage(ctx, c.UserID, msg.ConversationID, msgType, msg.Content)
	if err != nil {
		c.sendError("send_failed", err.Error())
		return
	}

	// Confirm to sender
	sentPayload := MessageSentPayload{
		ID:             message.ID,
		ConversationID: msg.ConversationID,
		ClientID:       msg.ClientID,
		CreatedAt:      message.CreatedAt.UnixMilli(),
	}
	envelope, _ := NewEnvelope(EventTypeMessageSent, sentPayload)
	c.send <- envelope

	// Broadcast to other subscribers
	newMsgPayload := NewMessagePayload{
		ID:             message.ID,
		ConversationID: msg.ConversationID,
		SenderID:       c.UserID,
		Type:           string(message.Type),
		Content:        message.Content,
		CreatedAt:      message.CreatedAt.UnixMilli(),
	}
	broadcastEnvelope, _ := NewEnvelope(EventTypeNewMessage, newMsgPayload)
	c.hub.SendToConversation(msg.ConversationID, broadcastEnvelope, c)

	// Clear typing indicator
	c.clearTyping()
}

func (c *Client) handleTypingStart(payload json.RawMessage) {
	var typing TypingPayload
	if err := json.Unmarshal(payload, &typing); err != nil {
		return
	}

	// Verify access
	if !c.subscriptions[typing.ConversationID] {
		return
	}

	// Set typing state
	c.typingConversation = &typing.ConversationID

	// Clear previous timer
	if c.typingTimer != nil {
		c.typingTimer.Stop()
	}

	// Auto-clear typing after 5 seconds
	c.typingTimer = time.AfterFunc(5*time.Second, func() {
		c.clearTyping()
	})

	// Broadcast typing indicator
	indicator := TypingIndicatorPayload{
		ConversationID: typing.ConversationID,
		UserID:         c.UserID,
		IsTyping:       true,
	}
	envelope, _ := NewEnvelope(EventTypeTypingIndicator, indicator)
	c.hub.SendToConversation(typing.ConversationID, envelope, c)
}

func (c *Client) handleTypingStop(payload json.RawMessage) {
	var typing TypingPayload
	if err := json.Unmarshal(payload, &typing); err != nil {
		return
	}

	c.clearTyping()
}

func (c *Client) clearTyping() {
	if c.typingTimer != nil {
		c.typingTimer.Stop()
		c.typingTimer = nil
	}

	if c.typingConversation != nil {
		indicator := TypingIndicatorPayload{
			ConversationID: *c.typingConversation,
			UserID:         c.UserID,
			IsTyping:       false,
		}
		envelope, _ := NewEnvelope(EventTypeTypingIndicator, indicator)
		c.hub.SendToConversation(*c.typingConversation, envelope, c)
		c.typingConversation = nil
	}
}

func (c *Client) handleMarkRead(payload json.RawMessage) {
	var mark MarkReadPayload
	if err := json.Unmarshal(payload, &mark); err != nil {
		c.sendError("invalid_payload", "Invalid mark read payload")
		return
	}

	// Mark as read via chat service
	ctx := context.Background()
	if err := c.chatService.MarkAsRead(ctx, c.UserID, mark.ConversationID); err != nil {
		c.sendError("mark_read_failed", err.Error())
		return
	}

	// Broadcast read receipt
	readPayload := MessagesReadPayload{
		ConversationID: mark.ConversationID,
		ReaderID:       c.UserID,
		ReadAt:         time.Now().UnixMilli(),
	}
	envelope, _ := NewEnvelope(EventTypeMessagesRead, readPayload)
	c.hub.SendToConversation(mark.ConversationID, envelope, c)
}

func (c *Client) sendError(code, message string) {
	payload := ErrorPayload{
		Code:    code,
		Message: message,
	}
	envelope, _ := NewEnvelope(EventTypeError, payload)
	c.send <- envelope
}

// handleCallRequest handles initiating a call to another user
func (c *Client) handleCallRequest(payload json.RawMessage) {
	var req CallSignalPayload
	if err := json.Unmarshal(payload, &req); err != nil {
		c.sendError("invalid_payload", "Invalid call request payload")
		return
	}

	// Get caller info for the notification
	ctx := context.Background()
	var callerName string
	var callerPhoto *string

	err := c.chatService.DB().Pool.QueryRow(ctx,
		"SELECT display_name, profile_photo FROM users WHERE id = $1",
		c.UserID,
	).Scan(&callerName, &callerPhoto)
	if err != nil {
		callerName = "Unknown"
	}

	// Build incoming call notification for target user
	incomingPayload := IncomingCallPayload{
		CallID:       req.CallID,
		CallerID:     c.UserID,
		CallerName:   callerName,
		CallerPhoto:  callerPhoto,
		VideoEnabled: req.VideoEnabled,
		MatchID:      req.MatchID,
	}

	envelope, _ := NewEnvelope(EventTypeCallRequest, incomingPayload)
	c.hub.SendToUser(req.TargetUserID, envelope)

	// Send push notification if target user is offline
	if c.callNotifier != nil && !c.hub.IsUserOnline(req.TargetUserID) {
		go c.callNotifier.NotifyIncomingCall(ctx, req.TargetUserID, callerName, callerPhoto, req.CallID, req.MatchID, req.VideoEnabled)
	}

	log.Printf("[Client] Call request: from=%s to=%s call_id=%s", c.UserID, req.TargetUserID, req.CallID)
}

// handleCallSignal relays call signaling messages to the target user
func (c *Client) handleCallSignal(eventType EventType, payload json.RawMessage) {
	var signal CallSignalPayload
	if err := json.Unmarshal(payload, &signal); err != nil {
		c.sendError("invalid_payload", "Invalid call signal payload")
		return
	}

	// Build the envelope to send to the target
	var outPayload interface{}

	switch eventType {
	case EventTypeCallOffer, EventTypeCallAnswer:
		outPayload = CallSDPPayload{
			CallID: signal.CallID,
			SDP:    signal.SDP,
		}
	case EventTypeCallCandidate:
		outPayload = CallCandidatePayload{
			CallID:    signal.CallID,
			Candidate: signal.Candidate,
		}
	default:
		outPayload = CallStatusPayload{
			CallID: signal.CallID,
			Reason: signal.Reason,
		}
	}

	envelope, _ := NewEnvelope(eventType, outPayload)
	c.hub.SendToUser(signal.TargetUserID, envelope)

	log.Printf("[Client] Call signal: type=%s from=%s to=%s call_id=%s", eventType, c.UserID, signal.TargetUserID, signal.CallID)
}
