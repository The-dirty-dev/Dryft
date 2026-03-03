package links

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
)

type mockLinksHandlerService struct {
	createLinkFn       func(ctx context.Context, linkType LinkType, userID, targetID string, metadata map[string]string, expiresIn time.Duration, maxUses int) (*Link, error)
	getLinkFn          func(ctx context.Context, code string) (*Link, error)
	validateLinkFn     func(ctx context.Context, code string) (*Link, error)
	useLinkFn          func(ctx context.Context, code string) (*Link, error)
	createVRInviteFn   func(ctx context.Context, hostID string, guestID string, roomType string, expiresIn time.Duration) (*VRInvite, error)
	getVRInviteFn      func(ctx context.Context, code string) (*VRInvite, error)
	validateVRInviteFn func(ctx context.Context, code string) (*VRInvite, error)
	acceptVRInviteFn   func(ctx context.Context, code string, guestID string) (*VRInvite, error)
	declineVRInviteFn  func(ctx context.Context, code string) error
	cancelVRInviteFn   func(ctx context.Context, code string, hostID string) error
	getUserInvitesFn   func(ctx context.Context, userID string, status string) ([]VRInvite, error)
	buildLinkURLFn     func(linkType LinkType, code string) string
}

func (m *mockLinksHandlerService) CreateLink(ctx context.Context, linkType LinkType, userID, targetID string, metadata map[string]string, expiresIn time.Duration, maxUses int) (*Link, error) {
	if m.createLinkFn == nil {
		return &Link{Code: "abc123", Type: linkType}, nil
	}
	return m.createLinkFn(ctx, linkType, userID, targetID, metadata, expiresIn, maxUses)
}
func (m *mockLinksHandlerService) GetLink(ctx context.Context, code string) (*Link, error) {
	if m.getLinkFn == nil {
		return &Link{Code: code, Type: LinkTypeProfile}, nil
	}
	return m.getLinkFn(ctx, code)
}
func (m *mockLinksHandlerService) ValidateLink(ctx context.Context, code string) (*Link, error) {
	if m.validateLinkFn == nil {
		return &Link{Code: code, Type: LinkTypeProfile}, nil
	}
	return m.validateLinkFn(ctx, code)
}
func (m *mockLinksHandlerService) UseLink(ctx context.Context, code string) (*Link, error) {
	if m.useLinkFn == nil {
		return &Link{Code: code, Type: LinkTypeProfile}, nil
	}
	return m.useLinkFn(ctx, code)
}
func (m *mockLinksHandlerService) CreateVRInvite(ctx context.Context, hostID string, guestID string, roomType string, expiresIn time.Duration) (*VRInvite, error) {
	if m.createVRInviteFn == nil {
		return &VRInvite{Code: "vr1", HostID: hostID, GuestID: guestID, RoomType: roomType, ExpiresAt: time.Now().Add(expiresIn), Status: "pending"}, nil
	}
	return m.createVRInviteFn(ctx, hostID, guestID, roomType, expiresIn)
}
func (m *mockLinksHandlerService) GetVRInvite(ctx context.Context, code string) (*VRInvite, error) {
	if m.getVRInviteFn == nil {
		return &VRInvite{Code: code, HostID: "host1", Status: "pending", ExpiresAt: time.Now().Add(time.Hour)}, nil
	}
	return m.getVRInviteFn(ctx, code)
}
func (m *mockLinksHandlerService) ValidateVRInvite(ctx context.Context, code string) (*VRInvite, error) {
	if m.validateVRInviteFn == nil {
		return &VRInvite{Code: code, HostID: "host1", Status: "pending", ExpiresAt: time.Now().Add(time.Hour)}, nil
	}
	return m.validateVRInviteFn(ctx, code)
}
func (m *mockLinksHandlerService) AcceptVRInvite(ctx context.Context, code string, guestID string) (*VRInvite, error) {
	if m.acceptVRInviteFn == nil {
		return &VRInvite{Code: code, HostID: "host1", GuestID: guestID, Status: "accepted"}, nil
	}
	return m.acceptVRInviteFn(ctx, code, guestID)
}
func (m *mockLinksHandlerService) DeclineVRInvite(ctx context.Context, code string) error {
	if m.declineVRInviteFn == nil {
		return nil
	}
	return m.declineVRInviteFn(ctx, code)
}
func (m *mockLinksHandlerService) CancelVRInvite(ctx context.Context, code string, hostID string) error {
	if m.cancelVRInviteFn == nil {
		return nil
	}
	return m.cancelVRInviteFn(ctx, code, hostID)
}
func (m *mockLinksHandlerService) GetUserVRInvites(ctx context.Context, userID string, status string) ([]VRInvite, error) {
	if m.getUserInvitesFn == nil {
		return []VRInvite{}, nil
	}
	return m.getUserInvitesFn(ctx, userID, status)
}
func (m *mockLinksHandlerService) BuildLinkURL(linkType LinkType, code string) string {
	if m.buildLinkURLFn == nil {
		return "https://app.dryft.site/i/" + code
	}
	return m.buildLinkURLFn(linkType, code)
}

func withLinksUser(req *http.Request, userID string) *http.Request {
	return req.WithContext(context.WithValue(req.Context(), "user_id", userID))
}

func TestCreateLink_GetAndValidate_Success(t *testing.T) {
	h := &Handler{service: &mockLinksHandlerService{}}

	createReq := withLinksUser(httptest.NewRequest(http.MethodPost, "/links", bytes.NewBufferString(`{"type":"profile","expires_in_seconds":60}`)), "u1")
	createRec := httptest.NewRecorder()
	h.CreateLink(createRec, createReq)
	if createRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", createRec.Code)
	}

	getRouter := chi.NewRouter()
	getRouter.Get("/links/{code}", h.GetLink)
	getReq := httptest.NewRequest(http.MethodGet, "/links/abc123", nil)
	getRec := httptest.NewRecorder()
	getRouter.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", getRec.Code)
	}

	validateRouter := chi.NewRouter()
	validateRouter.Post("/links/{code}/validate", h.ValidateLink)
	validateReq := httptest.NewRequest(http.MethodPost, "/links/abc123/validate", nil)
	validateRec := httptest.NewRecorder()
	validateRouter.ServeHTTP(validateRec, validateReq)
	if validateRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", validateRec.Code)
	}
}

func TestVRInvite_CreateAcceptDeclineCancel(t *testing.T) {
	h := &Handler{service: &mockLinksHandlerService{}}

	createReq := withLinksUser(httptest.NewRequest(http.MethodPost, "/links/vr-invite", bytes.NewBufferString(`{"guest_id":"u2","room_type":"private","expires_in_seconds":600}`)), "u1")
	createRec := httptest.NewRecorder()
	h.CreateVRInvite(createRec, createReq)
	if createRec.Code != http.StatusOK {
		t.Fatalf("expected create 200, got %d", createRec.Code)
	}

	router := chi.NewRouter()
	router.Post("/links/vr-invite/{code}/accept", func(w http.ResponseWriter, req *http.Request) {
		h.AcceptVRInvite(w, withLinksUser(req, "u2"))
	})
	router.Post("/links/vr-invite/{code}/decline", h.DeclineVRInvite)
	router.Post("/links/vr-invite/{code}/cancel", func(w http.ResponseWriter, req *http.Request) {
		h.CancelVRInvite(w, withLinksUser(req, "u1"))
	})

	acceptReq := httptest.NewRequest(http.MethodPost, "/links/vr-invite/vr1/accept", nil)
	acceptRec := httptest.NewRecorder()
	router.ServeHTTP(acceptRec, acceptReq)
	if acceptRec.Code != http.StatusOK {
		t.Fatalf("expected accept 200, got %d", acceptRec.Code)
	}

	declineReq := httptest.NewRequest(http.MethodPost, "/links/vr-invite/vr1/decline", nil)
	declineRec := httptest.NewRecorder()
	router.ServeHTTP(declineRec, declineReq)
	if declineRec.Code != http.StatusOK {
		t.Fatalf("expected decline 200, got %d", declineRec.Code)
	}

	cancelReq := httptest.NewRequest(http.MethodPost, "/links/vr-invite/vr1/cancel", nil)
	cancelRec := httptest.NewRecorder()
	router.ServeHTTP(cancelRec, cancelReq)
	if cancelRec.Code != http.StatusOK {
		t.Fatalf("expected cancel 200, got %d", cancelRec.Code)
	}
}

func TestGetLink_ExpiredReturnsGone(t *testing.T) {
	h := &Handler{service: &mockLinksHandlerService{
		getLinkFn: func(context.Context, string) (*Link, error) {
			return nil, ErrLinkExpired
		},
	}}

	r := chi.NewRouter()
	r.Get("/links/{code}", h.GetLink)
	req := httptest.NewRequest(http.MethodGet, "/links/expired", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusGone {
		t.Fatalf("expected 410, got %d", rec.Code)
	}
}

func TestGetUserVRInvites_ResponseShape(t *testing.T) {
	h := &Handler{service: &mockLinksHandlerService{
		getUserInvitesFn: func(context.Context, string, string) ([]VRInvite, error) {
			return []VRInvite{{Code: "vr1"}}, nil
		},
	}}
	r := chi.NewRouter()
	r.Get("/links/user/{userId}/vr-invites", h.GetUserVRInvites)
	req := httptest.NewRequest(http.MethodGet, "/links/user/u1/vr-invites", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if _, ok := body["invites"]; !ok {
		t.Fatalf("missing invites key")
	}
}
