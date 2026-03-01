package calls

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// SignalType represents the type of WebRTC signaling message
type SignalType string

const (
	SignalTypeOffer       SignalType = "offer"
	SignalTypeAnswer      SignalType = "answer"
	SignalTypeCandidate   SignalType = "candidate"
	SignalTypeCallRequest SignalType = "call_request"
	SignalTypeCallAccept  SignalType = "call_accept"
	SignalTypeCallReject  SignalType = "call_reject"
	SignalTypeCallEnd     SignalType = "call_end"
	SignalTypeCallBusy    SignalType = "call_busy"
	SignalTypeRinging     SignalType = "ringing"
	SignalTypeMute        SignalType = "mute"
	SignalTypeUnmute      SignalType = "unmute"
	SignalTypeVideoOff    SignalType = "video_off"
	SignalTypeVideoOn     SignalType = "video_on"
)

// SignalMessage represents a signaling message
type SignalMessage struct {
	Type      SignalType      `json:"type"`
	From      uuid.UUID       `json:"from"`
	To        uuid.UUID       `json:"to"`
	CallID    uuid.UUID       `json:"call_id"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	Timestamp time.Time       `json:"timestamp"`
}

// CallRequest is the payload for initiating a call
type CallRequest struct {
	VideoEnabled bool   `json:"video_enabled"`
	MatchID      string `json:"match_id"`
}

// SDPPayload contains SDP offer/answer
type SDPPayload struct {
	SDP  string `json:"sdp"`
	Type string `json:"type"` // "offer" or "answer"
}

// ICECandidate contains an ICE candidate
type ICECandidate struct {
	Candidate     string `json:"candidate"`
	SDPMid        string `json:"sdpMid"`
	SDPMLineIndex int    `json:"sdpMLineIndex"`
}

// ActiveCall represents an ongoing call
type ActiveCall struct {
	ID           uuid.UUID `json:"id"`
	CallerID     uuid.UUID `json:"caller_id"`
	CalleeID     uuid.UUID `json:"callee_id"`
	MatchID      uuid.UUID `json:"match_id"`
	VideoEnabled bool      `json:"video_enabled"`
	State        CallState `json:"state"`
	StartedAt    time.Time `json:"started_at"`
	AnsweredAt   time.Time `json:"answered_at,omitempty"`
	EndedAt      time.Time `json:"ended_at,omitempty"`
}

// CallState represents the state of a call
type CallState string

const (
	CallStateRinging   CallState = "ringing"
	CallStateConnected CallState = "connected"
	CallStateEnded     CallState = "ended"
)

// SignalingHub manages WebRTC signaling connections
type SignalingHub struct {
	mu          sync.RWMutex
	connections map[uuid.UUID]*websocket.Conn
	activeCalls map[uuid.UUID]*ActiveCall
	callRepo    CallRepository
}

// CallRepository interface for persisting call history
type CallRepository interface {
	CreateCall(ctx context.Context, call *ActiveCall) error
	UpdateCall(ctx context.Context, call *ActiveCall) error
	GetCallHistory(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*ActiveCall, error)
}

// NewSignalingHub creates a new signaling hub
func NewSignalingHub(repo CallRepository) *SignalingHub {
	return &SignalingHub{
		connections: make(map[uuid.UUID]*websocket.Conn),
		activeCalls: make(map[uuid.UUID]*ActiveCall),
		callRepo:    repo,
	}
}

// RegisterConnection registers a WebSocket connection for a user
func (h *SignalingHub) RegisterConnection(userID uuid.UUID, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Close existing connection if any
	if existing, ok := h.connections[userID]; ok {
		existing.Close()
	}

	h.connections[userID] = conn
	log.Printf("[SignalingHub] User %s connected", userID)
}

// pendingWrite holds a message and the connection it should be sent to.
// It is used to collect writes while holding the lock and dispatch them after
// the lock is released, avoiding both deadlocks and lock-held I/O.
type pendingWrite struct {
	conn *websocket.Conn
	msg  SignalMessage
}

// UnregisterConnection removes a user's connection
func (h *SignalingHub) UnregisterConnection(userID uuid.UUID) {
	var pending []pendingWrite

	h.mu.Lock()
	if conn, ok := h.connections[userID]; ok {
		conn.Close()
		delete(h.connections, userID)
	}

	// End any active calls for this user
	for callID, call := range h.activeCalls {
		if call.CallerID == userID || call.CalleeID == userID {
			call.State = CallStateEnded
			call.EndedAt = time.Now()

			// Collect notification for the other party
			otherID := call.CalleeID
			if call.CalleeID == userID {
				otherID = call.CallerID
			}

			if conn, ok := h.connections[otherID]; ok {
				pending = append(pending, pendingWrite{
					conn: conn,
					msg: SignalMessage{
						Type:      SignalTypeCallEnd,
						From:      userID,
						To:        otherID,
						CallID:    callID,
						Timestamp: time.Now(),
					},
				})
			}

			delete(h.activeCalls, callID)
		}
	}
	h.mu.Unlock()

	// Send notifications outside the lock
	for _, pw := range pending {
		if data, err := json.Marshal(pw.msg); err == nil {
			pw.conn.WriteMessage(websocket.TextMessage, data)
		}
	}

	log.Printf("[SignalingHub] User %s disconnected", userID)
}

// IsUserOnline checks if a user is connected
func (h *SignalingHub) IsUserOnline(userID uuid.UUID) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, ok := h.connections[userID]
	return ok
}

// IsUserInCall checks if a user is in an active call
func (h *SignalingHub) IsUserInCall(userID uuid.UUID) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, call := range h.activeCalls {
		if (call.CallerID == userID || call.CalleeID == userID) && call.State != CallStateEnded {
			return true
		}
	}
	return false
}

// HandleMessage processes an incoming signaling message
func (h *SignalingHub) HandleMessage(ctx context.Context, msg SignalMessage) error {
	switch msg.Type {
	case SignalTypeCallRequest:
		return h.handleCallRequest(ctx, msg)
	case SignalTypeCallAccept:
		return h.handleCallAccept(ctx, msg)
	case SignalTypeCallReject:
		return h.handleCallReject(ctx, msg)
	case SignalTypeCallEnd:
		return h.handleCallEnd(ctx, msg)
	case SignalTypeOffer, SignalTypeAnswer, SignalTypeCandidate:
		return h.forwardMessage(msg)
	case SignalTypeMute, SignalTypeUnmute, SignalTypeVideoOff, SignalTypeVideoOn:
		return h.forwardMessage(msg)
	default:
		log.Printf("[SignalingHub] Unknown message type: %s", msg.Type)
		return nil
	}
}

func (h *SignalingHub) handleCallRequest(ctx context.Context, msg SignalMessage) error {
	// Check if callee is online
	if !h.IsUserOnline(msg.To) {
		h.sendToUser(msg.From, SignalMessage{
			Type:      SignalTypeCallEnd,
			From:      msg.To,
			To:        msg.From,
			CallID:    msg.CallID,
			Payload:   json.RawMessage(`{"reason":"user_offline"}`),
			Timestamp: time.Now(),
		})
		return nil
	}

	// Check if callee is already in a call
	if h.IsUserInCall(msg.To) {
		h.sendToUser(msg.From, SignalMessage{
			Type:      SignalTypeCallBusy,
			From:      msg.To,
			To:        msg.From,
			CallID:    msg.CallID,
			Timestamp: time.Now(),
		})
		return nil
	}

	// Parse call request
	var req CallRequest
	if msg.Payload != nil {
		json.Unmarshal(msg.Payload, &req)
	}

	matchID, _ := uuid.Parse(req.MatchID)

	// Create active call
	call := &ActiveCall{
		ID:           msg.CallID,
		CallerID:     msg.From,
		CalleeID:     msg.To,
		MatchID:      matchID,
		VideoEnabled: req.VideoEnabled,
		State:        CallStateRinging,
		StartedAt:    time.Now(),
	}

	h.mu.Lock()
	h.activeCalls[msg.CallID] = call
	h.mu.Unlock()

	// Persist call
	if h.callRepo != nil {
		h.callRepo.CreateCall(ctx, call)
	}

	// Forward to callee
	h.sendToUser(msg.To, msg)

	// Start ringing timeout (30 seconds)
	go h.ringTimeout(msg.CallID, 30*time.Second)

	return nil
}

func (h *SignalingHub) ringTimeout(callID uuid.UUID, duration time.Duration) {
	time.Sleep(duration)

	var pending []pendingWrite

	h.mu.Lock()
	call, ok := h.activeCalls[callID]
	if ok && call.State == CallStateRinging {
		call.State = CallStateEnded
		call.EndedAt = time.Now()

		// Collect notifications for both parties
		if conn, exists := h.connections[call.CallerID]; exists {
			pending = append(pending, pendingWrite{
				conn: conn,
				msg: SignalMessage{
					Type:      SignalTypeCallEnd,
					From:      call.CalleeID,
					To:        call.CallerID,
					CallID:    callID,
					Payload:   json.RawMessage(`{"reason":"no_answer"}`),
					Timestamp: time.Now(),
				},
			})
		}
		if conn, exists := h.connections[call.CalleeID]; exists {
			pending = append(pending, pendingWrite{
				conn: conn,
				msg: SignalMessage{
					Type:      SignalTypeCallEnd,
					From:      call.CallerID,
					To:        call.CalleeID,
					CallID:    callID,
					Payload:   json.RawMessage(`{"reason":"no_answer"}`),
					Timestamp: time.Now(),
				},
			})
		}

		delete(h.activeCalls, callID)
	}
	h.mu.Unlock()

	// Send notifications outside the lock
	for _, pw := range pending {
		if data, err := json.Marshal(pw.msg); err == nil {
			pw.conn.WriteMessage(websocket.TextMessage, data)
		}
	}
}

func (h *SignalingHub) handleCallAccept(ctx context.Context, msg SignalMessage) error {
	h.mu.Lock()
	call, ok := h.activeCalls[msg.CallID]
	if !ok {
		h.mu.Unlock()
		return nil
	}

	call.State = CallStateConnected
	call.AnsweredAt = time.Now()
	h.mu.Unlock()

	// Update in database
	if h.callRepo != nil {
		h.callRepo.UpdateCall(ctx, call)
	}

	// Notify caller that call was accepted
	h.sendToUser(msg.To, SignalMessage{
		Type:      SignalTypeCallAccept,
		From:      msg.From,
		To:        msg.To,
		CallID:    msg.CallID,
		Timestamp: time.Now(),
	})

	return nil
}

func (h *SignalingHub) handleCallReject(ctx context.Context, msg SignalMessage) error {
	h.mu.Lock()
	call, ok := h.activeCalls[msg.CallID]
	if ok {
		call.State = CallStateEnded
		call.EndedAt = time.Now()
		delete(h.activeCalls, msg.CallID)
	}
	h.mu.Unlock()

	if h.callRepo != nil && call != nil {
		h.callRepo.UpdateCall(ctx, call)
	}

	// Notify caller
	h.sendToUser(msg.To, msg)

	return nil
}

func (h *SignalingHub) handleCallEnd(ctx context.Context, msg SignalMessage) error {
	h.mu.Lock()
	call, ok := h.activeCalls[msg.CallID]
	if ok {
		call.State = CallStateEnded
		call.EndedAt = time.Now()
		delete(h.activeCalls, msg.CallID)
	}
	h.mu.Unlock()

	if h.callRepo != nil && call != nil {
		h.callRepo.UpdateCall(ctx, call)
	}

	// Notify the other party
	h.sendToUser(msg.To, msg)

	return nil
}

func (h *SignalingHub) forwardMessage(msg SignalMessage) error {
	return h.sendToUser(msg.To, msg)
}

func (h *SignalingHub) sendToUser(userID uuid.UUID, msg SignalMessage) error {
	h.mu.RLock()
	conn, ok := h.connections[userID]
	h.mu.RUnlock()

	if !ok {
		return nil
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	return conn.WriteMessage(websocket.TextMessage, data)
}

// GetActiveCall returns an active call by ID
func (h *SignalingHub) GetActiveCall(callID uuid.UUID) *ActiveCall {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.activeCalls[callID]
}

// GetUserActiveCall returns the active call for a user
func (h *SignalingHub) GetUserActiveCall(userID uuid.UUID) *ActiveCall {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, call := range h.activeCalls {
		if (call.CallerID == userID || call.CalleeID == userID) && call.State != CallStateEnded {
			return call
		}
	}
	return nil
}
