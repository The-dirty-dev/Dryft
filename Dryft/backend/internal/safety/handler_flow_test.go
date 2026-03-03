package safety

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type mockSafetyHandlerService struct {
	blockUserFn             func(ctx context.Context, userID, blockedUserID uuid.UUID, reason string) error
	unblockUserFn           func(ctx context.Context, userID, blockedUserID uuid.UUID) error
	getBlockedUsersFn       func(ctx context.Context, userID uuid.UUID) ([]BlockedUser, error)
	isBlockedFn             func(ctx context.Context, userID, potentiallyBlockedID uuid.UUID) (bool, error)
	submitReportFn          func(ctx context.Context, report *Report) error
	getUserReportsFn        func(ctx context.Context, userID uuid.UUID) ([]Report, error)
	recordPanicEventFn      func(ctx context.Context, event *PanicEvent) error
	getActiveWarningsFn     func(ctx context.Context, userID uuid.UUID) ([]Warning, error)
	getPendingReportsFn     func(ctx context.Context, limit, offset int) ([]Report, int64, error)
	getReportsAgainstUserFn func(ctx context.Context, userID uuid.UUID) ([]Report, error)
	updateReportStatusFn    func(ctx context.Context, reportID uuid.UUID, reviewerID uuid.UUID, status, resolution string) error
	issueWarningFn          func(ctx context.Context, warning *Warning) error
	getUserWarningsFn       func(ctx context.Context, userID uuid.UUID) ([]Warning, error)
	getPanicEventsFn        func(ctx context.Context, userID uuid.UUID) ([]PanicEvent, error)
}

func (m *mockSafetyHandlerService) BlockUser(ctx context.Context, userID, blockedUserID uuid.UUID, reason string) error {
	return m.blockUserFn(ctx, userID, blockedUserID, reason)
}
func (m *mockSafetyHandlerService) UnblockUser(ctx context.Context, userID, blockedUserID uuid.UUID) error {
	return m.unblockUserFn(ctx, userID, blockedUserID)
}
func (m *mockSafetyHandlerService) GetBlockedUsers(ctx context.Context, userID uuid.UUID) ([]BlockedUser, error) {
	if m.getBlockedUsersFn == nil {
		return []BlockedUser{}, nil
	}
	return m.getBlockedUsersFn(ctx, userID)
}
func (m *mockSafetyHandlerService) IsBlocked(ctx context.Context, userID, potentiallyBlockedID uuid.UUID) (bool, error) {
	if m.isBlockedFn == nil {
		return false, nil
	}
	return m.isBlockedFn(ctx, userID, potentiallyBlockedID)
}
func (m *mockSafetyHandlerService) SubmitReport(ctx context.Context, report *Report) error {
	return m.submitReportFn(ctx, report)
}
func (m *mockSafetyHandlerService) GetUserReports(ctx context.Context, userID uuid.UUID) ([]Report, error) {
	if m.getUserReportsFn == nil {
		return []Report{}, nil
	}
	return m.getUserReportsFn(ctx, userID)
}
func (m *mockSafetyHandlerService) RecordPanicEvent(ctx context.Context, event *PanicEvent) error {
	if m.recordPanicEventFn == nil {
		return nil
	}
	return m.recordPanicEventFn(ctx, event)
}
func (m *mockSafetyHandlerService) GetActiveWarnings(ctx context.Context, userID uuid.UUID) ([]Warning, error) {
	if m.getActiveWarningsFn == nil {
		return []Warning{}, nil
	}
	return m.getActiveWarningsFn(ctx, userID)
}
func (m *mockSafetyHandlerService) GetPendingReports(ctx context.Context, limit, offset int) ([]Report, int64, error) {
	if m.getPendingReportsFn == nil {
		return []Report{}, 0, nil
	}
	return m.getPendingReportsFn(ctx, limit, offset)
}
func (m *mockSafetyHandlerService) GetReportsAgainstUser(ctx context.Context, userID uuid.UUID) ([]Report, error) {
	if m.getReportsAgainstUserFn == nil {
		return []Report{}, nil
	}
	return m.getReportsAgainstUserFn(ctx, userID)
}
func (m *mockSafetyHandlerService) UpdateReportStatus(ctx context.Context, reportID uuid.UUID, reviewerID uuid.UUID, status, resolution string) error {
	if m.updateReportStatusFn == nil {
		return nil
	}
	return m.updateReportStatusFn(ctx, reportID, reviewerID, status, resolution)
}
func (m *mockSafetyHandlerService) IssueWarning(ctx context.Context, warning *Warning) error {
	if m.issueWarningFn == nil {
		return nil
	}
	return m.issueWarningFn(ctx, warning)
}
func (m *mockSafetyHandlerService) GetUserWarnings(ctx context.Context, userID uuid.UUID) ([]Warning, error) {
	if m.getUserWarningsFn == nil {
		return []Warning{}, nil
	}
	return m.getUserWarningsFn(ctx, userID)
}
func (m *mockSafetyHandlerService) GetPanicEvents(ctx context.Context, userID uuid.UUID) ([]PanicEvent, error) {
	if m.getPanicEventsFn == nil {
		return []PanicEvent{}, nil
	}
	return m.getPanicEventsFn(ctx, userID)
}

func TestBlockUser_Success(t *testing.T) {
	caller := uuid.New()
	target := uuid.New()
	h := &Handler{
		service: &mockSafetyHandlerService{
			blockUserFn: func(_ context.Context, userID, blockedUserID uuid.UUID, reason string) error {
				if userID != caller || blockedUserID != target || reason != "spam" {
					t.Fatalf("unexpected block args")
				}
				return nil
			},
			unblockUserFn:  func(context.Context, uuid.UUID, uuid.UUID) error { return nil },
			submitReportFn: func(context.Context, *Report) error { return nil },
		},
	}

	body, _ := json.Marshal(BlockRequest{UserID: target, Reason: "spam"})
	req := httptest.NewRequest(http.MethodPost, "/safety/block", bytes.NewReader(body))
	req = setUserIDInContext(req, caller)
	rec := httptest.NewRecorder()
	h.BlockUser(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestUnblockUser_NotBlocked(t *testing.T) {
	caller := uuid.New()
	target := uuid.New()
	h := &Handler{
		service: &mockSafetyHandlerService{
			blockUserFn: func(context.Context, uuid.UUID, uuid.UUID, string) error { return nil },
			unblockUserFn: func(context.Context, uuid.UUID, uuid.UUID) error {
				return ErrNotBlocked
			},
			submitReportFn: func(context.Context, *Report) error { return nil },
		},
	}

	r := chi.NewRouter()
	r.Delete("/safety/block/{userId}", h.UnblockUser)
	req := httptest.NewRequest(http.MethodDelete, "/safety/block/"+target.String(), nil)
	req = setUserIDInContext(req, caller)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestSubmitReport_Duplicate(t *testing.T) {
	caller := uuid.New()
	target := uuid.New()
	h := &Handler{
		service: &mockSafetyHandlerService{
			blockUserFn:   func(context.Context, uuid.UUID, uuid.UUID, string) error { return nil },
			unblockUserFn: func(context.Context, uuid.UUID, uuid.UUID) error { return nil },
			submitReportFn: func(context.Context, *Report) error {
				return ErrDuplicateReport
			},
		},
	}

	body, _ := json.Marshal(ReportRequest{
		ReportedUserID: target,
		Category:       "spam",
		Reason:         "test",
	})
	req := httptest.NewRequest(http.MethodPost, "/safety/report", bytes.NewReader(body))
	req = setUserIDInContext(req, caller)
	rec := httptest.NewRecorder()
	h.SubmitReport(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", rec.Code)
	}
}
