package admin

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	authmw "github.com/dryft-app/backend/internal/middleware"
)

type mockAdminHandlerService struct {
	isAdminFn           func(ctx context.Context, userID uuid.UUID) (bool, error)
	getDashboardStatsFn func(ctx context.Context) (*DashboardStats, error)
	getVerificationsFn  func(ctx context.Context, status string, limit, offset int) ([]VerificationReview, int, error)
	getVerificationFn   func(ctx context.Context, verificationID uuid.UUID) (*VerificationReview, error)
	approveFn           func(ctx context.Context, adminID, verificationID uuid.UUID, notes string) error
	rejectFn            func(ctx context.Context, adminID, verificationID uuid.UUID, reason, notes string) error
	getPendingReportsFn func(ctx context.Context, limit, offset int) ([]UserReport, int, error)
	reviewReportFn      func(ctx context.Context, adminID, reportID uuid.UUID, action, notes string) error
	getUserFn           func(ctx context.Context, userID uuid.UUID) (*UserOverview, error)
	banUserFn           func(ctx context.Context, adminID, userID uuid.UUID, reason, notes string) error
	unbanUserFn         func(ctx context.Context, adminID, userID uuid.UUID, notes string) error
}

func (m *mockAdminHandlerService) IsAdmin(ctx context.Context, userID uuid.UUID) (bool, error) {
	if m.isAdminFn == nil {
		return false, nil
	}
	return m.isAdminFn(ctx, userID)
}
func (m *mockAdminHandlerService) GetDashboardStats(ctx context.Context) (*DashboardStats, error) {
	if m.getDashboardStatsFn == nil {
		return &DashboardStats{}, nil
	}
	return m.getDashboardStatsFn(ctx)
}
func (m *mockAdminHandlerService) GetVerifications(ctx context.Context, status string, limit, offset int) ([]VerificationReview, int, error) {
	if m.getVerificationsFn == nil {
		return []VerificationReview{}, 0, nil
	}
	return m.getVerificationsFn(ctx, status, limit, offset)
}
func (m *mockAdminHandlerService) GetVerification(ctx context.Context, verificationID uuid.UUID) (*VerificationReview, error) {
	if m.getVerificationFn == nil {
		return &VerificationReview{}, nil
	}
	return m.getVerificationFn(ctx, verificationID)
}
func (m *mockAdminHandlerService) ApproveVerification(ctx context.Context, adminID, verificationID uuid.UUID, notes string) error {
	if m.approveFn == nil {
		return nil
	}
	return m.approveFn(ctx, adminID, verificationID, notes)
}
func (m *mockAdminHandlerService) RejectVerification(ctx context.Context, adminID, verificationID uuid.UUID, reason, notes string) error {
	if m.rejectFn == nil {
		return nil
	}
	return m.rejectFn(ctx, adminID, verificationID, reason, notes)
}
func (m *mockAdminHandlerService) GetPendingReports(ctx context.Context, limit, offset int) ([]UserReport, int, error) {
	if m.getPendingReportsFn == nil {
		return []UserReport{}, 0, nil
	}
	return m.getPendingReportsFn(ctx, limit, offset)
}
func (m *mockAdminHandlerService) ReviewReport(ctx context.Context, adminID, reportID uuid.UUID, action, notes string) error {
	if m.reviewReportFn == nil {
		return nil
	}
	return m.reviewReportFn(ctx, adminID, reportID, action, notes)
}
func (m *mockAdminHandlerService) GetUser(ctx context.Context, userID uuid.UUID) (*UserOverview, error) {
	if m.getUserFn == nil {
		return &UserOverview{}, nil
	}
	return m.getUserFn(ctx, userID)
}
func (m *mockAdminHandlerService) BanUser(ctx context.Context, adminID, userID uuid.UUID, reason, notes string) error {
	if m.banUserFn == nil {
		return nil
	}
	return m.banUserFn(ctx, adminID, userID, reason, notes)
}
func (m *mockAdminHandlerService) UnbanUser(ctx context.Context, adminID, userID uuid.UUID, notes string) error {
	if m.unbanUserFn == nil {
		return nil
	}
	return m.unbanUserFn(ctx, adminID, userID, notes)
}

func setAdminUser(req *http.Request, id uuid.UUID) *http.Request {
	return req.WithContext(context.WithValue(req.Context(), authmw.UserIDKey, id))
}

func TestGetDashboard_Success(t *testing.T) {
	h := &Handler{
		service: &mockAdminHandlerService{
			getDashboardStatsFn: func(context.Context) (*DashboardStats, error) {
				return &DashboardStats{TotalUsers: 10}, nil
			},
		},
	}
	req := httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil)
	rec := httptest.NewRecorder()
	h.GetDashboard(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestGetVerifications_Pagination(t *testing.T) {
	h := &Handler{
		service: &mockAdminHandlerService{
			getVerificationsFn: func(_ context.Context, _ string, limit, offset int) ([]VerificationReview, int, error) {
				if limit != 20 || offset != 40 {
					t.Fatalf("unexpected pagination limit=%d offset=%d", limit, offset)
				}
				return []VerificationReview{}, 0, nil
			},
		},
	}
	req := httptest.NewRequest(http.MethodGet, "/admin/verifications?page=3&per_page=20", nil)
	rec := httptest.NewRecorder()
	h.GetVerifications(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestApproveVerification_Success(t *testing.T) {
	adminID := uuid.New()
	verificationID := uuid.New()
	h := &Handler{
		service: &mockAdminHandlerService{
			approveFn: func(_ context.Context, gotAdminID, gotVerificationID uuid.UUID, _ string) error {
				if gotAdminID != adminID || gotVerificationID != verificationID {
					t.Fatalf("unexpected ids")
				}
				return nil
			},
		},
	}
	r := chi.NewRouter()
	r.Post("/admin/verifications/{id}/approve", func(w http.ResponseWriter, req *http.Request) {
		h.ApproveVerification(w, setAdminUser(req, adminID))
	})
	req := httptest.NewRequest(http.MethodPost, "/admin/verifications/"+verificationID.String()+"/approve", bytes.NewBufferString(`{"notes":"ok"}`))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestRejectVerification_MissingReason(t *testing.T) {
	adminID := uuid.New()
	verificationID := uuid.New()
	h := &Handler{service: &mockAdminHandlerService{}}
	r := chi.NewRouter()
	r.Post("/admin/verifications/{id}/reject", func(w http.ResponseWriter, req *http.Request) {
		h.RejectVerification(w, setAdminUser(req, adminID))
	})
	req := httptest.NewRequest(http.MethodPost, "/admin/verifications/"+verificationID.String()+"/reject", bytes.NewBufferString(`{"reason":""}`))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestBanAndUnbanUser_Success(t *testing.T) {
	adminID := uuid.New()
	targetID := uuid.New()
	h := &Handler{
		service: &mockAdminHandlerService{
			banUserFn: func(_ context.Context, gotAdminID, gotUserID uuid.UUID, reason, _ string) error {
				if gotAdminID != adminID || gotUserID != targetID || reason == "" {
					t.Fatalf("unexpected ban args")
				}
				return nil
			},
			unbanUserFn: func(_ context.Context, gotAdminID, gotUserID uuid.UUID, _ string) error {
				if gotAdminID != adminID || gotUserID != targetID {
					t.Fatalf("unexpected unban args")
				}
				return nil
			},
		},
	}

	r := chi.NewRouter()
	r.Post("/admin/users/{id}/ban", func(w http.ResponseWriter, req *http.Request) {
		h.BanUser(w, setAdminUser(req, adminID))
	})
	r.Post("/admin/users/{id}/unban", func(w http.ResponseWriter, req *http.Request) {
		h.UnbanUser(w, setAdminUser(req, adminID))
	})

	banReq := httptest.NewRequest(http.MethodPost, "/admin/users/"+targetID.String()+"/ban", bytes.NewBufferString(`{"reason":"tos violation"}`))
	banRec := httptest.NewRecorder()
	r.ServeHTTP(banRec, banReq)
	if banRec.Code != http.StatusOK {
		t.Fatalf("expected ban 200, got %d", banRec.Code)
	}

	unbanReq := httptest.NewRequest(http.MethodPost, "/admin/users/"+targetID.String()+"/unban", bytes.NewBufferString(`{"notes":"appeal accepted"}`))
	unbanRec := httptest.NewRecorder()
	r.ServeHTTP(unbanRec, unbanReq)
	if unbanRec.Code != http.StatusOK {
		t.Fatalf("expected unban 200, got %d", unbanRec.Code)
	}
}

func TestAdminMiddleware_NonAdminRejected(t *testing.T) {
	adminID := uuid.New()
	h := &Handler{
		service: &mockAdminHandlerService{
			isAdminFn: func(context.Context, uuid.UUID) (bool, error) { return false, nil },
		},
	}

	next := h.AdminMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil)
	req = setAdminUser(req, adminID)
	rec := httptest.NewRecorder()
	next.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}

func TestGetVerifications_ResponseShape(t *testing.T) {
	h := &Handler{
		service: &mockAdminHandlerService{
			getVerificationsFn: func(context.Context, string, int, int) ([]VerificationReview, int, error) {
				return []VerificationReview{}, 2, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/verifications", nil)
	rec := httptest.NewRecorder()
	h.GetVerifications(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if _, ok := body["verifications"]; !ok {
		t.Fatalf("missing verifications key: %+v", body)
	}
}
