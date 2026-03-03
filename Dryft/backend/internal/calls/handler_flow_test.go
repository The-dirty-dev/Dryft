package calls

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type mockCallsHub struct {
	registerConnectionFn func(userID uuid.UUID, conn *websocket.Conn)
	unregisterFn         func(userID uuid.UUID)
	handleMessageFn      func(ctx context.Context, msg SignalMessage) error
	isUserInCallFn       func(userID uuid.UUID) bool
	getUserActiveCallFn  func(userID uuid.UUID) *ActiveCall
	getActiveCallFn      func(callID uuid.UUID) *ActiveCall
}

func (m *mockCallsHub) RegisterConnection(userID uuid.UUID, conn *websocket.Conn) {
	if m.registerConnectionFn != nil {
		m.registerConnectionFn(userID, conn)
	}
}

func (m *mockCallsHub) UnregisterConnection(userID uuid.UUID) {
	if m.unregisterFn != nil {
		m.unregisterFn(userID)
	}
}

func (m *mockCallsHub) HandleMessage(ctx context.Context, msg SignalMessage) error {
	if m.handleMessageFn == nil {
		return nil
	}
	return m.handleMessageFn(ctx, msg)
}

func (m *mockCallsHub) IsUserInCall(userID uuid.UUID) bool {
	if m.isUserInCallFn == nil {
		return false
	}
	return m.isUserInCallFn(userID)
}

func (m *mockCallsHub) GetUserActiveCall(userID uuid.UUID) *ActiveCall {
	if m.getUserActiveCallFn == nil {
		return nil
	}
	return m.getUserActiveCallFn(userID)
}

func (m *mockCallsHub) GetActiveCall(callID uuid.UUID) *ActiveCall {
	if m.getActiveCallFn == nil {
		return nil
	}
	return m.getActiveCallFn(callID)
}

type mockCallsRepo struct {
	createCallFn     func(ctx context.Context, call *ActiveCall) error
	updateCallFn     func(ctx context.Context, call *ActiveCall) error
	getHistoryCallFn func(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*ActiveCall, error)
}

func (m *mockCallsRepo) CreateCall(ctx context.Context, call *ActiveCall) error {
	if m.createCallFn == nil {
		return nil
	}
	return m.createCallFn(ctx, call)
}

func (m *mockCallsRepo) UpdateCall(ctx context.Context, call *ActiveCall) error {
	if m.updateCallFn == nil {
		return nil
	}
	return m.updateCallFn(ctx, call)
}

func (m *mockCallsRepo) GetCallHistory(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*ActiveCall, error) {
	if m.getHistoryCallFn == nil {
		return []*ActiveCall{}, nil
	}
	return m.getHistoryCallFn(ctx, userID, limit, offset)
}

type mockMatchLookup struct {
	getMatchOtherUserFn func(ctx context.Context, matchID, userID uuid.UUID) (uuid.UUID, error)
}

func (m *mockMatchLookup) GetMatchOtherUser(ctx context.Context, matchID, userID uuid.UUID) (uuid.UUID, error) {
	return m.getMatchOtherUserFn(ctx, matchID, userID)
}

func withCallsUser(req *http.Request, userID uuid.UUID) *http.Request {
	return req.WithContext(context.WithValue(req.Context(), userIDContextKey, userID))
}

func TestInitiateCall_Success(t *testing.T) {
	userID := uuid.New()
	matchID := uuid.New()
	calleeID := uuid.New()

	h := &Handler{
		hub: &mockCallsHub{
			isUserInCallFn: func(gotUserID uuid.UUID) bool {
				return gotUserID == uuid.Nil
			},
		},
		callRepo: &mockCallsRepo{},
		matchLookup: &mockMatchLookup{
			getMatchOtherUserFn: func(_ context.Context, gotMatchID, gotUserID uuid.UUID) (uuid.UUID, error) {
				if gotMatchID != matchID || gotUserID != userID {
					t.Fatalf("unexpected match lookup args")
				}
				return calleeID, nil
			},
		},
	}

	body := bytes.NewBufferString(`{"match_id":"` + matchID.String() + `","video_enabled":true}`)
	req := httptest.NewRequest(http.MethodPost, "/v1/calls/initiate", body)
	req = withCallsUser(req, userID)
	rec := httptest.NewRecorder()

	h.InitiateCall(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var payload map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload["callee_id"] != calleeID.String() {
		t.Fatalf("unexpected response payload: %+v", payload)
	}
}

func TestInitiateCall_AlreadyInCall(t *testing.T) {
	userID := uuid.New()
	matchID := uuid.New()

	h := &Handler{
		hub: &mockCallsHub{
			isUserInCallFn: func(uuid.UUID) bool { return true },
		},
		callRepo: &mockCallsRepo{},
		matchLookup: &mockMatchLookup{
			getMatchOtherUserFn: func(context.Context, uuid.UUID, uuid.UUID) (uuid.UUID, error) {
				return uuid.New(), nil
			},
		},
	}

	body := bytes.NewBufferString(`{"match_id":"` + matchID.String() + `","video_enabled":false}`)
	req := httptest.NewRequest(http.MethodPost, "/v1/calls/initiate", body)
	req = withCallsUser(req, userID)
	rec := httptest.NewRecorder()

	h.InitiateCall(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", rec.Code)
	}
}

func TestGetActiveCall_NoActiveCall(t *testing.T) {
	userID := uuid.New()
	h := &Handler{
		hub: &mockCallsHub{
			getUserActiveCallFn: func(gotUserID uuid.UUID) *ActiveCall {
				if gotUserID != userID {
					t.Fatalf("unexpected user id: %s", gotUserID)
				}
				return nil
			},
		},
		callRepo:    &mockCallsRepo{},
		matchLookup: &mockMatchLookup{getMatchOtherUserFn: func(context.Context, uuid.UUID, uuid.UUID) (uuid.UUID, error) { return uuid.Nil, nil }},
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/calls/active", nil)
	req = withCallsUser(req, userID)
	rec := httptest.NewRecorder()
	h.GetActiveCall(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var payload map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload["active"] != false {
		t.Fatalf("expected active=false, got %+v", payload)
	}
}

func TestEndCall_Success(t *testing.T) {
	userID := uuid.New()
	otherID := uuid.New()
	callID := uuid.New()
	var handled SignalMessage

	h := &Handler{
		hub: &mockCallsHub{
			getActiveCallFn: func(gotCallID uuid.UUID) *ActiveCall {
				if gotCallID != callID {
					t.Fatalf("unexpected call id: %s", gotCallID)
				}
				return &ActiveCall{
					ID:       callID,
					CallerID: userID,
					CalleeID: otherID,
				}
			},
			handleMessageFn: func(_ context.Context, msg SignalMessage) error {
				handled = msg
				return nil
			},
		},
		callRepo:    &mockCallsRepo{},
		matchLookup: &mockMatchLookup{getMatchOtherUserFn: func(context.Context, uuid.UUID, uuid.UUID) (uuid.UUID, error) { return uuid.Nil, nil }},
	}

	r := chi.NewRouter()
	r.Post("/v1/calls/{id}/end", func(w http.ResponseWriter, req *http.Request) {
		h.EndCall(w, withCallsUser(req, userID))
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/calls/"+callID.String()+"/end", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if handled.Type != SignalTypeCallEnd || handled.To != otherID || handled.From != userID || handled.CallID != callID {
		t.Fatalf("unexpected signal message: %+v", handled)
	}
}

func TestEndCall_ForbiddenWhenNotParticipant(t *testing.T) {
	userID := uuid.New()
	callID := uuid.New()
	h := &Handler{
		hub: &mockCallsHub{
			getActiveCallFn: func(uuid.UUID) *ActiveCall {
				return &ActiveCall{
					ID:       callID,
					CallerID: uuid.New(),
					CalleeID: uuid.New(),
				}
			},
		},
		callRepo:    &mockCallsRepo{},
		matchLookup: &mockMatchLookup{getMatchOtherUserFn: func(context.Context, uuid.UUID, uuid.UUID) (uuid.UUID, error) { return uuid.Nil, nil }},
	}

	r := chi.NewRouter()
	r.Post("/v1/calls/{id}/end", func(w http.ResponseWriter, req *http.Request) {
		h.EndCall(w, withCallsUser(req, userID))
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/calls/"+callID.String()+"/end", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}

func TestInitiateCall_NotPartOfMatch(t *testing.T) {
	userID := uuid.New()
	matchID := uuid.New()
	h := &Handler{
		hub:      &mockCallsHub{},
		callRepo: &mockCallsRepo{},
		matchLookup: &mockMatchLookup{
			getMatchOtherUserFn: func(context.Context, uuid.UUID, uuid.UUID) (uuid.UUID, error) {
				return uuid.Nil, errors.New("not found")
			},
		},
	}

	body := bytes.NewBufferString(`{"match_id":"` + matchID.String() + `","video_enabled":false}`)
	req := httptest.NewRequest(http.MethodPost, "/v1/calls/initiate", body)
	req = withCallsUser(req, userID)
	rec := httptest.NewRecorder()

	h.InitiateCall(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}
