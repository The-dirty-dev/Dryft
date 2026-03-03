package session

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/models"
)

type mockSessionHandlerService struct {
	createSessionFn         func(ctx context.Context, hostID uuid.UUID, req models.CreateSessionRequest) (*models.CreateSessionResponse, error)
	getUserActiveSessionFn  func(ctx context.Context, userID uuid.UUID) (*models.CompanionSession, error)
	getSessionInfoFn        func(ctx context.Context, sessionID, userID uuid.UUID) (*models.SessionInfo, error)
	joinSessionFn           func(ctx context.Context, userID uuid.UUID, req models.JoinSessionRequest) (*models.SessionInfo, error)
	endSessionFn            func(ctx context.Context, sessionID, userID uuid.UUID) error
	leaveSessionFn          func(ctx context.Context, sessionID, userID uuid.UUID) error
	setHapticPermissionFn   func(ctx context.Context, sessionID, ownerID uuid.UUID, req models.SetHapticPermissionRequest) error
	sendSessionChatFn       func(ctx context.Context, sessionID, senderID uuid.UUID, content string) error
	checkHapticPermissionFn func(ctx context.Context, sessionID, controllerID, targetID uuid.UUID) (bool, float64, error)
}

func (m *mockSessionHandlerService) CreateSession(ctx context.Context, hostID uuid.UUID, req models.CreateSessionRequest) (*models.CreateSessionResponse, error) {
	return m.createSessionFn(ctx, hostID, req)
}
func (m *mockSessionHandlerService) GetUserActiveSession(ctx context.Context, userID uuid.UUID) (*models.CompanionSession, error) {
	if m.getUserActiveSessionFn == nil {
		return nil, nil
	}
	return m.getUserActiveSessionFn(ctx, userID)
}
func (m *mockSessionHandlerService) GetSessionInfo(ctx context.Context, sessionID, userID uuid.UUID) (*models.SessionInfo, error) {
	if m.getSessionInfoFn == nil {
		return &models.SessionInfo{}, nil
	}
	return m.getSessionInfoFn(ctx, sessionID, userID)
}
func (m *mockSessionHandlerService) JoinSession(ctx context.Context, userID uuid.UUID, req models.JoinSessionRequest) (*models.SessionInfo, error) {
	return m.joinSessionFn(ctx, userID, req)
}
func (m *mockSessionHandlerService) EndSession(ctx context.Context, sessionID, userID uuid.UUID) error {
	return m.endSessionFn(ctx, sessionID, userID)
}
func (m *mockSessionHandlerService) LeaveSession(ctx context.Context, sessionID, userID uuid.UUID) error {
	return m.leaveSessionFn(ctx, sessionID, userID)
}
func (m *mockSessionHandlerService) SetHapticPermission(ctx context.Context, sessionID, ownerID uuid.UUID, req models.SetHapticPermissionRequest) error {
	if m.setHapticPermissionFn == nil {
		return nil
	}
	return m.setHapticPermissionFn(ctx, sessionID, ownerID, req)
}
func (m *mockSessionHandlerService) SendSessionChat(ctx context.Context, sessionID, senderID uuid.UUID, content string) error {
	if m.sendSessionChatFn == nil {
		return nil
	}
	return m.sendSessionChatFn(ctx, sessionID, senderID, content)
}
func (m *mockSessionHandlerService) CheckHapticPermission(ctx context.Context, sessionID, controllerID, targetID uuid.UUID) (bool, float64, error) {
	if m.checkHapticPermissionFn == nil {
		return true, 1.0, nil
	}
	return m.checkHapticPermissionFn(ctx, sessionID, controllerID, targetID)
}
func (m *mockSessionHandlerService) broadcastSessionHaptic(sessionID, fromUserID, toUserID uuid.UUID, commandType string, intensity float64, durationMs int, patternName string) {
}

func TestCreateSession_Success(t *testing.T) {
	uid := uuid.New()
	expected := &models.CreateSessionResponse{SessionID: uuid.New(), SessionCode: "ABC123"}
	h := &Handler{
		service: &mockSessionHandlerService{
			createSessionFn: func(_ context.Context, hostID uuid.UUID, _ models.CreateSessionRequest) (*models.CreateSessionResponse, error) {
				if hostID != uid {
					t.Fatalf("unexpected hostID: %s", hostID)
				}
				return expected, nil
			},
			joinSessionFn: func(context.Context, uuid.UUID, models.JoinSessionRequest) (*models.SessionInfo, error) {
				return nil, nil
			},
			endSessionFn:   func(context.Context, uuid.UUID, uuid.UUID) error { return nil },
			leaveSessionFn: func(context.Context, uuid.UUID, uuid.UUID) error { return nil },
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/session", strings.NewReader(`{}`))
	req = setUserIDCtx(req, uid)
	rec := httptest.NewRecorder()
	h.CreateSession(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rec.Code)
	}
	var body models.CreateSessionResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.SessionCode != "ABC123" {
		t.Fatalf("unexpected response: %+v", body)
	}
}

func TestJoinSession_MapsSessionFullToConflict(t *testing.T) {
	uid := uuid.New()
	h := &Handler{
		service: &mockSessionHandlerService{
			createSessionFn: func(context.Context, uuid.UUID, models.CreateSessionRequest) (*models.CreateSessionResponse, error) {
				return nil, nil
			},
			joinSessionFn: func(_ context.Context, _ uuid.UUID, _ models.JoinSessionRequest) (*models.SessionInfo, error) {
				return nil, ErrSessionFull
			},
			endSessionFn:   func(context.Context, uuid.UUID, uuid.UUID) error { return nil },
			leaveSessionFn: func(context.Context, uuid.UUID, uuid.UUID) error { return nil },
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/session/join", strings.NewReader(`{"session_code":"ABC123"}`))
	req = setUserIDCtx(req, uid)
	rec := httptest.NewRecorder()
	h.JoinSession(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", rec.Code)
	}
}

func TestEndSession_NotHost(t *testing.T) {
	uid := uuid.New()
	h := &Handler{
		service: &mockSessionHandlerService{
			createSessionFn: func(context.Context, uuid.UUID, models.CreateSessionRequest) (*models.CreateSessionResponse, error) {
				return nil, nil
			},
			joinSessionFn: func(context.Context, uuid.UUID, models.JoinSessionRequest) (*models.SessionInfo, error) {
				return nil, nil
			},
			endSessionFn: func(context.Context, uuid.UUID, uuid.UUID) error {
				return ErrNotSessionHost
			},
			leaveSessionFn: func(context.Context, uuid.UUID, uuid.UUID) error { return nil },
		},
	}

	sessionID := uuid.New()
	r := chi.NewRouter()
	r.Delete("/{sessionId}", h.EndSession)

	req := httptest.NewRequest(http.MethodDelete, "/"+sessionID.String(), nil)
	req = setUserIDCtx(req, uid)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}
