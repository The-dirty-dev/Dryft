package calls

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dryft-app/backend/internal/httputil"
	"github.com/dryft-app/backend/internal/realtime"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     realtime.CheckOrigin,
}

// MatchLookup verifies match membership and returns the other party's ID
type MatchLookup interface {
	GetMatchOtherUser(ctx context.Context, matchID, userID uuid.UUID) (uuid.UUID, error)
}

// Handler handles WebRTC signaling HTTP requests
type Handler struct {
	hub         signalingHub
	callRepo    CallRepository
	matchLookup MatchLookup
}

type signalingHub interface {
	RegisterConnection(userID uuid.UUID, conn *websocket.Conn)
	UnregisterConnection(userID uuid.UUID)
	HandleMessage(ctx context.Context, msg SignalMessage) error
	IsUserInCall(userID uuid.UUID) bool
	GetUserActiveCall(userID uuid.UUID) *ActiveCall
	GetActiveCall(callID uuid.UUID) *ActiveCall
}

// NewHandler creates a new calls handler
func NewHandler(hub *SignalingHub, repo CallRepository, matchLookup MatchLookup) *Handler {
	return &Handler{
		hub:         hub,
		callRepo:    repo,
		matchLookup: matchLookup,
	}
}

// HandleWebSocket handles WebSocket connections for signaling
func (h *Handler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.RespondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Warn("calls websocket upgrade failed", "error", err)
		return
	}

	h.hub.RegisterConnection(userID, conn)
	defer h.hub.UnregisterConnection(userID)

	// Read messages
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				slog.Warn("calls websocket read failed", "user_id", userID, "error", err)
			}
			break
		}

		var msg SignalMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			slog.Warn("calls websocket invalid signal payload", "user_id", userID, "error", err)
			continue
		}

		msg.From = userID
		msg.Timestamp = time.Now()

		if err := h.hub.HandleMessage(r.Context(), msg); err != nil {
			slog.Warn("calls websocket message handling failed", "user_id", userID, "type", msg.Type, "error", err)
		}
	}
}

// InitiateCall handles POST /v1/calls/initiate
func (h *Handler) InitiateCall(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req struct {
		MatchID      string `json:"match_id"`
		VideoEnabled bool   `json:"video_enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	matchID, err := uuid.Parse(req.MatchID)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid match_id")
		return
	}

	// Verify that user is part of this match and get the other party
	calleeID, err := h.matchLookup.GetMatchOtherUser(r.Context(), matchID, userID)
	if err != nil {
		httputil.WriteError(w, http.StatusForbidden, "not part of this match")
		return
	}

	// Check if caller is already in a call
	if h.hub.IsUserInCall(userID) {
		httputil.WriteError(w, http.StatusConflict, "already in a call")
		return
	}

	callID := uuid.New()

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"call_id":       callID.String(),
		"match_id":      matchID.String(),
		"callee_id":     calleeID.String(),
		"video_enabled": req.VideoEnabled,
	})
}

// GetCallHistory handles GET /v1/calls/history
func (h *Handler) GetCallHistory(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	calls, err := h.callRepo.GetCallHistory(r.Context(), userID, 50, 0)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get call history")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"calls": calls,
	})
}

// GetActiveCall handles GET /v1/calls/active
func (h *Handler) GetActiveCall(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	call := h.hub.GetUserActiveCall(userID)
	if call == nil {
		httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
			"active": false,
		})
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"active": true,
		"call":   call,
	})
}

// EndCall handles POST /v1/calls/{id}/end
func (h *Handler) EndCall(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	callIDStr := chi.URLParam(r, "id")
	callID, err := uuid.Parse(callIDStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid call_id")
		return
	}

	call := h.hub.GetActiveCall(callID)
	if call == nil {
		httputil.WriteError(w, http.StatusNotFound, "call not found")
		return
	}

	if call.CallerID != userID && call.CalleeID != userID {
		httputil.WriteError(w, http.StatusForbidden, "not part of this call")
		return
	}

	// Determine the other party
	otherID := call.CalleeID
	if call.CalleeID == userID {
		otherID = call.CallerID
	}

	msg := SignalMessage{
		Type:      SignalTypeCallEnd,
		From:      userID,
		To:        otherID,
		CallID:    callID,
		Timestamp: time.Now(),
	}

	h.hub.HandleMessage(r.Context(), msg)

	httputil.WriteJSON(w, http.StatusOK, map[string]string{
		"status": "ended",
	})
}

// RegisterRoutes registers call routes
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/ws", h.HandleWebSocket)
	r.Post("/initiate", h.InitiateCall)
	r.Get("/history", h.GetCallHistory)
	r.Get("/active", h.GetActiveCall)
	r.Post("/{id}/end", h.EndCall)
}

// Helper functions

type contextKey string

const userIDContextKey contextKey = "user_id"

func getUserIDFromContext(r *http.Request) (uuid.UUID, error) {
	if id, ok := r.Context().Value(userIDContextKey).(uuid.UUID); ok {
		return id, nil
	}
	return uuid.Nil, http.ErrNoCookie
}

// CallRepositoryImpl implements CallRepository using PostgreSQL via pgxpool.
type CallRepositoryImpl struct {
	pool *pgxpool.Pool
}

// NewCallRepository creates a new call repository.
// Pass nil to get a no-op repository (useful for tests or when DB is unavailable).
func NewCallRepository(pool *pgxpool.Pool) *CallRepositoryImpl {
	return &CallRepositoryImpl{pool: pool}
}

func (r *CallRepositoryImpl) CreateCall(ctx context.Context, call *ActiveCall) error {
	if r.pool == nil {
		return nil
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO call_history (id, caller_id, callee_id, match_id, video_enabled, state, started_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, call.ID, call.CallerID, call.CalleeID, call.MatchID, call.VideoEnabled, call.State, call.StartedAt)
	return err
}

func (r *CallRepositoryImpl) UpdateCall(ctx context.Context, call *ActiveCall) error {
	if r.pool == nil {
		return nil
	}
	_, err := r.pool.Exec(ctx, `
		UPDATE call_history
		SET state = $2, answered_at = $3, ended_at = $4
		WHERE id = $1
	`, call.ID, call.State, nullTime(call.AnsweredAt), nullTime(call.EndedAt))
	return err
}

func (r *CallRepositoryImpl) GetCallHistory(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*ActiveCall, error) {
	if r.pool == nil {
		return []*ActiveCall{}, nil
	}
	rows, err := r.pool.Query(ctx, `
		SELECT id, caller_id, callee_id, match_id, video_enabled, state, started_at, answered_at, ended_at
		FROM call_history
		WHERE caller_id = $1 OR callee_id = $1
		ORDER BY started_at DESC
		LIMIT $2 OFFSET $3
	`, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var calls []*ActiveCall
	for rows.Next() {
		c := &ActiveCall{}
		var answeredAt, endedAt *time.Time
		if err := rows.Scan(&c.ID, &c.CallerID, &c.CalleeID, &c.MatchID, &c.VideoEnabled, &c.State, &c.StartedAt, &answeredAt, &endedAt); err != nil {
			return nil, err
		}
		if answeredAt != nil {
			c.AnsweredAt = *answeredAt
		}
		if endedAt != nil {
			c.EndedAt = *endedAt
		}
		calls = append(calls, c)
	}

	if calls == nil {
		calls = []*ActiveCall{}
	}
	return calls, rows.Err()
}

// nullTime returns nil for zero time values (so Postgres stores NULL).
func nullTime(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	return &t
}
