package voice

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type mockVoiceHandlerService struct {
	joinSessionFn      func(ctx context.Context, sessionID, userID uuid.UUID, displayName string) error
	leaveSessionFn     func(ctx context.Context, sessionID, userID uuid.UUID) error
	getParticipantsFn  func(ctx context.Context, sessionID uuid.UUID) ([]Participant, error)
	setSpeakingStateFn func(ctx context.Context, sessionID, userID uuid.UUID, speaking bool) error
	setMutedStateFn    func(ctx context.Context, sessionID, userID uuid.UUID, muted bool) error
}

func (m *mockVoiceHandlerService) JoinSession(ctx context.Context, sessionID, userID uuid.UUID, displayName string) error {
	if m.joinSessionFn == nil {
		return nil
	}
	return m.joinSessionFn(ctx, sessionID, userID, displayName)
}

func (m *mockVoiceHandlerService) LeaveSession(ctx context.Context, sessionID, userID uuid.UUID) error {
	if m.leaveSessionFn == nil {
		return nil
	}
	return m.leaveSessionFn(ctx, sessionID, userID)
}

func (m *mockVoiceHandlerService) GetParticipants(ctx context.Context, sessionID uuid.UUID) ([]Participant, error) {
	if m.getParticipantsFn == nil {
		return []Participant{}, nil
	}
	return m.getParticipantsFn(ctx, sessionID)
}

func (m *mockVoiceHandlerService) SetSpeakingState(ctx context.Context, sessionID, userID uuid.UUID, speaking bool) error {
	if m.setSpeakingStateFn == nil {
		return nil
	}
	return m.setSpeakingStateFn(ctx, sessionID, userID, speaking)
}

func (m *mockVoiceHandlerService) SetMutedState(ctx context.Context, sessionID, userID uuid.UUID, muted bool) error {
	if m.setMutedStateFn == nil {
		return nil
	}
	return m.setMutedStateFn(ctx, sessionID, userID, muted)
}

type mockVoiceBroadcaster struct {
	broadcastToSessionFn func(sessionID uuid.UUID, message interface{}) error
	sendToUserFn         func(userID uuid.UUID, message interface{}) error
}

func (m *mockVoiceBroadcaster) BroadcastToSession(sessionID uuid.UUID, message interface{}) error {
	if m.broadcastToSessionFn == nil {
		return nil
	}
	return m.broadcastToSessionFn(sessionID, message)
}

func (m *mockVoiceBroadcaster) SendToUser(userID uuid.UUID, message interface{}) error {
	if m.sendToUserFn == nil {
		return nil
	}
	return m.sendToUserFn(userID, message)
}

func TestServeVoiceWS_InvalidSessionID(t *testing.T) {
	h := &Handler{service: &mockVoiceHandlerService{}}
	r := chi.NewRouter()
	r.Get("/voice/session/{sessionId}", h.ServeVoiceWS)

	req := httptest.NewRequest(http.MethodGet, "/voice/session/not-a-uuid", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestServeVoiceWS_Unauthorized(t *testing.T) {
	h := &Handler{service: &mockVoiceHandlerService{}}
	r := chi.NewRouter()
	r.Get("/voice/session/{sessionId}", h.ServeVoiceWS)

	req := httptest.NewRequest(http.MethodGet, "/voice/session/"+uuid.NewString(), nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestGetParticipants_Success(t *testing.T) {
	sessionID := uuid.New()
	userID := uuid.New()

	h := &Handler{
		service: &mockVoiceHandlerService{
			getParticipantsFn: func(_ context.Context, gotSessionID uuid.UUID) ([]Participant, error) {
				if gotSessionID != sessionID {
					t.Fatalf("unexpected session id: %s", gotSessionID)
				}
				return []Participant{{UserID: userID, DisplayName: "Alice"}}, nil
			},
		},
	}

	r := chi.NewRouter()
	r.Get("/voice/session/{sessionId}/participants", h.GetParticipants)

	req := httptest.NewRequest(http.MethodGet, "/voice/session/"+sessionID.String()+"/participants", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["count"].(float64) != 1 {
		t.Fatalf("unexpected count: %+v", body)
	}
}

func TestGetParticipants_NotFound(t *testing.T) {
	sessionID := uuid.New()
	h := &Handler{
		service: &mockVoiceHandlerService{
			getParticipantsFn: func(context.Context, uuid.UUID) ([]Participant, error) {
				return nil, errors.New("not found")
			},
		},
	}

	r := chi.NewRouter()
	r.Get("/voice/session/{sessionId}/participants", h.GetParticipants)

	req := httptest.NewRequest(http.MethodGet, "/voice/session/"+sessionID.String()+"/participants", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestServeVoiceWS_JoinAndLeaveLifecycle(t *testing.T) {
	sessionID := uuid.New()
	userID := uuid.New()
	leaveCalled := make(chan struct{}, 1)

	h := &Handler{
		service: &mockVoiceHandlerService{
			joinSessionFn: func(_ context.Context, gotSessionID, gotUserID uuid.UUID, displayName string) error {
				if gotSessionID != sessionID || gotUserID != userID || displayName != "Alice" {
					t.Fatalf("unexpected join args")
				}
				return nil
			},
			getParticipantsFn: func(context.Context, uuid.UUID) ([]Participant, error) {
				return []Participant{{UserID: userID, DisplayName: "Alice"}}, nil
			},
			leaveSessionFn: func(_ context.Context, gotSessionID, gotUserID uuid.UUID) error {
				if gotSessionID != sessionID || gotUserID != userID {
					t.Fatalf("unexpected leave args")
				}
				leaveCalled <- struct{}{}
				return nil
			},
		},
		broadcaster: &mockVoiceBroadcaster{},
	}

	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := context.WithValue(req.Context(), "user_id", userID)
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})
	r.Get("/voice/session/{sessionId}", h.ServeVoiceWS)

	server := httptest.NewServer(r)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/voice/session/" + sessionID.String() + "?display_name=Alice"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial websocket: %v", err)
	}

	var msg VoiceMessage
	if err := conn.ReadJSON(&msg); err != nil {
		t.Fatalf("read join confirmation: %v", err)
	}
	if msg.Type != "voice_joined" {
		t.Fatalf("expected voice_joined, got %s", msg.Type)
	}

	if err := conn.Close(); err != nil {
		t.Fatalf("close websocket: %v", err)
	}

	select {
	case <-leaveCalled:
	case <-time.After(2 * time.Second):
		t.Fatal("expected LeaveSession to be called")
	}
}
