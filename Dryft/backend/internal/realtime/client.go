package realtime

import (
	"context"
	"encoding/json"
	"log"
	"log/slog"
	"strings"
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

var boothHostActions = map[string]struct{}{
	"lock_room":              {},
	"unlock_room":            {},
	"toggle_invite_only":     {},
	"toggle_companion_voice": {},
	"end_party":              {},
}

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

	// Request-scoped logger (includes request_id when available).
	logger *slog.Logger

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
		logger:        slog.Default().With("component", "realtime_client", "user_id", userID.String()),
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

	case EventTypeBoothInvite:
		c.handleBoothInvite(envelope.Payload)

	case EventTypeBoothInviteResponse:
		c.handleBoothInviteResponse(envelope.Payload)

	case EventTypeBoothPrivacyUpdate:
		c.handleBoothPrivacyUpdate(envelope.Payload)

	case EventTypeBoothHostControl:
		c.handleBoothHostControl(envelope.Payload)

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

func (c *Client) requestLogger() *slog.Logger {
	if c.logger != nil {
		return c.logger
	}
	return slog.Default().With("component", "realtime_client", "user_id", c.UserID.String())
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

	c.requestLogger().Info("call request relayed", "from_user_id", c.UserID, "to_user_id", req.TargetUserID, "call_id", req.CallID)
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

	c.requestLogger().Info("call signal relayed", "type", eventType, "from_user_id", c.UserID, "to_user_id", signal.TargetUserID, "call_id", signal.CallID)
}

func (c *Client) handleBoothInvite(payload json.RawMessage) {
	if c.UserID == uuid.Nil {
		c.sendError("unauthorized", "Authentication required")
		return
	}

	var invite BoothInvitePayload
	if err := json.Unmarshal(payload, &invite); err != nil {
		c.sendError("invalid_payload", "Invalid booth invite payload")
		return
	}

	invite.BoothID = strings.TrimSpace(invite.BoothID)
	if invite.BoothID == "" {
		c.sendError("invalid_payload", "booth_id is required")
		return
	}

	if invite.InviterID != "" {
		inviterID, err := uuid.Parse(invite.InviterID)
		if err != nil || inviterID == uuid.Nil {
			c.sendError("invalid_payload", "inviter_id must be a valid user id")
			return
		}
		if inviterID != c.UserID {
			c.sendError("forbidden", "inviter_id must match authenticated user")
			return
		}
	}

	inviteeID, err := uuid.Parse(strings.TrimSpace(invite.InviteeID))
	if err != nil || inviteeID == uuid.Nil {
		c.sendError("invalid_payload", "invitee_id must be a valid user id")
		return
	}

	invite.InviterID = c.UserID.String()
	envelope, _ := NewEnvelope(EventTypeBoothInvite, invite)
	c.hub.SendToUser(inviteeID, envelope)

	c.requestLogger().Info("booth invite relayed", "booth_id", invite.BoothID, "inviter_id", c.UserID, "invitee_id", inviteeID)
}

func (c *Client) handleBoothInviteResponse(payload json.RawMessage) {
	if c.UserID == uuid.Nil {
		c.sendError("unauthorized", "Authentication required")
		return
	}

	var response BoothInviteResponsePayload
	if err := json.Unmarshal(payload, &response); err != nil {
		c.sendError("invalid_payload", "Invalid booth invite response payload")
		return
	}

	response.BoothID = strings.TrimSpace(response.BoothID)
	if response.BoothID == "" {
		c.sendError("invalid_payload", "booth_id is required")
		return
	}

	inviterID, err := uuid.Parse(strings.TrimSpace(response.InviterID))
	if err != nil || inviterID == uuid.Nil {
		c.sendError("invalid_payload", "inviter_id must be a valid user id")
		return
	}

	inviteeID, err := uuid.Parse(strings.TrimSpace(response.InviteeID))
	if err != nil || inviteeID == uuid.Nil {
		c.sendError("invalid_payload", "invitee_id must be a valid user id")
		return
	}
	if inviteeID != c.UserID {
		c.sendError("forbidden", "invitee_id must match authenticated user")
		return
	}

	response.InviteeID = c.UserID.String()
	envelope, _ := NewEnvelope(EventTypeBoothInviteResponse, response)
	c.hub.SendToUser(inviterID, envelope)

	if response.Accepted {
		c.hub.AddBoothParticipant(response.BoothID, inviterID)
		c.hub.AddBoothParticipant(response.BoothID, inviteeID)
	}

	c.requestLogger().Info(
		"booth invite response relayed",
		"booth_id", response.BoothID,
		"inviter_id", inviterID,
		"invitee_id", inviteeID,
		"accepted", response.Accepted,
	)
}

func (c *Client) handleBoothPrivacyUpdate(payload json.RawMessage) {
	if c.UserID == uuid.Nil {
		c.sendError("unauthorized", "Authentication required")
		return
	}

	var raw struct {
		BoothPrivacyUpdatePayload
		HostUserID string `json:"host_user_id"`
	}
	if err := json.Unmarshal(payload, &raw); err != nil {
		c.sendError("invalid_payload", "Invalid booth privacy update payload")
		return
	}

	update := raw.BoothPrivacyUpdatePayload
	update.BoothID = strings.TrimSpace(update.BoothID)
	if update.BoothID == "" {
		c.sendError("invalid_payload", "booth_id is required")
		return
	}
	if update.MaxGuestCount < 0 {
		c.sendError("invalid_payload", "max_guest_count must be >= 0")
		return
	}

	hostIDRaw := strings.TrimSpace(update.HostID)
	if hostIDRaw == "" {
		hostIDRaw = strings.TrimSpace(raw.HostUserID)
	}
	hostID, err := uuid.Parse(hostIDRaw)
	if err != nil || hostID == uuid.Nil {
		c.sendError("invalid_payload", "host_id must be a valid user id")
		return
	}
	if hostID != c.UserID {
		c.sendError("forbidden", "only booth host can update privacy")
		return
	}

	update.HostID = hostID.String()
	c.hub.AddBoothParticipant(update.BoothID, hostID)
	envelope, _ := NewEnvelope(EventTypeBoothPrivacyUpdate, update)

	participants := c.hub.GetBoothParticipants(update.BoothID)
	if len(participants) == 0 {
		participants = []uuid.UUID{hostID}
	}
	for _, userID := range participants {
		c.hub.SendToUser(userID, envelope)
	}

	c.requestLogger().Info(
		"booth privacy update broadcast",
		"booth_id", update.BoothID,
		"host_id", hostID,
		"participants", len(participants),
		"invite_only", update.InviteOnly,
		"room_locked", update.RoomLocked,
		"companion_voice_allowed", update.CompanionVoiceAllowed,
		"max_guest_count", update.MaxGuestCount,
	)
}

func (c *Client) handleBoothHostControl(payload json.RawMessage) {
	if c.UserID == uuid.Nil {
		c.sendError("unauthorized", "Authentication required")
		return
	}

	var control BoothHostControlPayload
	if err := json.Unmarshal(payload, &control); err != nil {
		c.sendError("invalid_payload", "Invalid booth host control payload")
		return
	}

	control.BoothID = strings.TrimSpace(control.BoothID)
	control.Action = strings.TrimSpace(control.Action)
	if control.BoothID == "" {
		c.sendError("invalid_payload", "booth_id is required")
		return
	}
	if control.Action == "" {
		c.sendError("invalid_payload", "action is required")
		return
	}

	if _, ok := boothHostActions[control.Action]; !ok {
		c.sendError("invalid_payload", "invalid host control action")
		return
	}

	hostID, err := uuid.Parse(strings.TrimSpace(control.HostID))
	if err != nil || hostID == uuid.Nil {
		c.sendError("invalid_payload", "host_id must be a valid user id")
		return
	}
	if hostID != c.UserID {
		c.sendError("forbidden", "only booth host can run host controls")
		return
	}

	control.HostID = hostID.String()
	c.hub.AddBoothParticipant(control.BoothID, hostID)

	participants := c.hub.GetBoothParticipants(control.BoothID)
	if len(participants) == 0 {
		participants = []uuid.UUID{hostID}
	}

	envelope, _ := NewEnvelope(EventTypeBoothHostControl, control)
	for _, userID := range participants {
		c.hub.SendToUser(userID, envelope)
	}

	if control.Action == "end_party" {
		disconnectEnvelope, _ := NewEnvelope(EventTypeSessionEnded, BoothDisconnectPayload{
			BoothID: control.BoothID,
			Reason:  "end_party",
		})
		for _, userID := range participants {
			c.hub.SendToUser(userID, disconnectEnvelope)
		}
		c.hub.ClearBoothParticipants(control.BoothID)
	}

	c.requestLogger().Info(
		"booth host control broadcast",
		"booth_id", control.BoothID,
		"host_id", hostID,
		"action", control.Action,
		"participants", len(participants),
	)
}
