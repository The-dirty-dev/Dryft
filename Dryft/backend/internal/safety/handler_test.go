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

// setUserIDInContext sets user_id in context the way the handler expects.
func setUserIDInContext(req *http.Request, uid uuid.UUID) *http.Request {
	ctx := context.WithValue(req.Context(), "user_id", uid)
	return req.WithContext(ctx)
}

// ---------------------------------------------------------------------------
// isValidCategory
// ---------------------------------------------------------------------------

func TestIsValidCategory(t *testing.T) {
	valid := []string{"harassment", "inappropriate_content", "spam", "impersonation", "underage", "threats", "other"}
	for _, cat := range valid {
		if !isValidCategory(cat) {
			t.Errorf("expected %q to be valid", cat)
		}
	}

	invalid := []string{"", "hacking", "random", "HARASSMENT", "Spam"}
	for _, cat := range invalid {
		if isValidCategory(cat) {
			t.Errorf("expected %q to be invalid", cat)
		}
	}
}

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

func TestSentinelErrors(t *testing.T) {
	errors := map[error]string{
		ErrUserNotFound:    "user not found",
		ErrAlreadyBlocked:  "user already blocked",
		ErrNotBlocked:      "user not blocked",
		ErrCannotBlockSelf: "cannot block yourself",
		ErrInvalidCategory: "invalid report category",
		ErrDuplicateReport: "duplicate report within cooldown period",
	}
	for err, expected := range errors {
		if err.Error() != expected {
			t.Errorf("got %q, want %q", err.Error(), expected)
		}
	}
}

// ---------------------------------------------------------------------------
// writeJSON / writeError
// ---------------------------------------------------------------------------

func TestSafetyWriteJSON(t *testing.T) {
	rr := httptest.NewRecorder()
	writeJSON(rr, http.StatusOK, map[string]int{"count": 5})

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected application/json, got %q", ct)
	}
}

func TestSafetyWriteError(t *testing.T) {
	rr := httptest.NewRecorder()
	writeError(rr, http.StatusBadRequest, "invalid_input", "bad request")

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
	var body map[string]string
	json.NewDecoder(rr.Body).Decode(&body)
	if body["error"] != "invalid_input" {
		t.Errorf("expected error code 'invalid_input', got %q", body["error"])
	}
	if body["message"] != "bad request" {
		t.Errorf("expected message 'bad request', got %q", body["message"])
	}
}

// ---------------------------------------------------------------------------
// getUserIDFromContext
// ---------------------------------------------------------------------------

func TestSafetyGetUserIDFromContext_WithID(t *testing.T) {
	uid := uuid.New()
	req := httptest.NewRequest("GET", "/", nil)
	req = setUserIDInContext(req, uid)

	got := getUserIDFromContext(req)
	if got != uid {
		t.Errorf("got %v, want %v", got, uid)
	}
}

func TestSafetyGetUserIDFromContext_NoID(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	got := getUserIDFromContext(req)
	if got != uuid.Nil {
		t.Errorf("expected Nil UUID, got %v", got)
	}
}

// ---------------------------------------------------------------------------
// BlockUser handler – validation
// ---------------------------------------------------------------------------

func TestBlockUser_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/safety/block", bytes.NewReader([]byte(`not-json`)))
	req = setUserIDInContext(req, uid)
	rr := httptest.NewRecorder()

	h.BlockUser(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestBlockUser_NilUserID(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	body, _ := json.Marshal(BlockRequest{UserID: uuid.Nil, Reason: "test"})
	req := httptest.NewRequest("POST", "/safety/block", bytes.NewReader(body))
	req = setUserIDInContext(req, uid)
	rr := httptest.NewRecorder()

	h.BlockUser(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// UnblockUser handler – invalid UUID
// ---------------------------------------------------------------------------

func TestUnblockUser_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Delete("/safety/block/{userId}", h.UnblockUser)

	uid := uuid.New()
	req := httptest.NewRequest("DELETE", "/safety/block/not-uuid", nil)
	req = setUserIDInContext(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// CheckBlocked handler – invalid UUID
// ---------------------------------------------------------------------------

func TestCheckBlocked_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Get("/safety/blocked/{userId}/check", h.CheckBlocked)

	uid := uuid.New()
	req := httptest.NewRequest("GET", "/safety/blocked/not-uuid/check", nil)
	req = setUserIDInContext(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// SubmitReport handler – validation
// ---------------------------------------------------------------------------

func TestSubmitReport_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/safety/report", bytes.NewReader([]byte(`bad`)))
	req = setUserIDInContext(req, uid)
	rr := httptest.NewRecorder()

	h.SubmitReport(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestSubmitReport_MissingFields(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	body, _ := json.Marshal(ReportRequest{Category: "spam"}) // missing reported_user_id and reason
	req := httptest.NewRequest("POST", "/safety/report", bytes.NewReader(body))
	req = setUserIDInContext(req, uid)
	rr := httptest.NewRecorder()

	h.SubmitReport(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// Admin endpoints – invalid UUIDs
// ---------------------------------------------------------------------------

func TestGetReportsAgainstUser_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Get("/admin/safety/reports/user/{userId}", h.GetReportsAgainstUser)

	req := httptest.NewRequest("GET", "/admin/safety/reports/user/bad-id", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestUpdateReport_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Put("/admin/safety/reports/{reportId}", h.UpdateReport)

	uid := uuid.New()
	body, _ := json.Marshal(UpdateReportRequest{Status: "resolved"})
	req := httptest.NewRequest("PUT", "/admin/safety/reports/bad-id", bytes.NewReader(body))
	req = setUserIDInContext(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestUpdateReport_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Put("/admin/safety/reports/{reportId}", h.UpdateReport)

	uid := uuid.New()
	reportID := uuid.New().String()
	req := httptest.NewRequest("PUT", "/admin/safety/reports/"+reportID, bytes.NewReader([]byte(`bad`)))
	req = setUserIDInContext(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestIssueWarning_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/admin/safety/warnings", bytes.NewReader([]byte(`bad`)))
	req = setUserIDInContext(req, uid)
	rr := httptest.NewRecorder()

	h.IssueWarning(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestGetUserWarnings_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Get("/admin/safety/warnings/user/{userId}", h.GetUserWarnings)

	req := httptest.NewRequest("GET", "/admin/safety/warnings/user/bad-id", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestGetUserPanicEvents_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Get("/admin/safety/panic/user/{userId}", h.GetUserPanicEvents)

	req := httptest.NewRequest("GET", "/admin/safety/panic/user/bad-id", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// RegisterRoutes / RegisterAdminRoutes – structure
// ---------------------------------------------------------------------------

func TestRegisterRoutes_Structure(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	h.RegisterRoutes(r)

	routes := []struct {
		method string
		path   string
	}{
		{"POST", "/safety/block"},
		{"DELETE", "/safety/block/{userId}"},
		{"GET", "/safety/blocked"},
		{"GET", "/safety/blocked/{userId}/check"},
		{"POST", "/safety/report"},
		{"GET", "/safety/reports"},
		{"POST", "/safety/panic"},
		{"GET", "/safety/warnings"},
	}

	for _, rt := range routes {
		rctx := chi.NewRouteContext()
		if !r.Match(rctx, rt.method, rt.path) {
			t.Errorf("route %s %s not registered", rt.method, rt.path)
		}
	}
}

func TestRegisterAdminRoutes_Structure(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	h.RegisterAdminRoutes(r)

	routes := []struct {
		method string
		path   string
	}{
		{"GET", "/admin/safety/reports"},
		{"GET", "/admin/safety/reports/user/{userId}"},
		{"PUT", "/admin/safety/reports/{reportId}"},
		{"POST", "/admin/safety/warnings"},
		{"GET", "/admin/safety/warnings/user/{userId}"},
		{"GET", "/admin/safety/panic/user/{userId}"},
	}

	for _, rt := range routes {
		rctx := chi.NewRouteContext()
		if !r.Match(rctx, rt.method, rt.path) {
			t.Errorf("admin route %s %s not registered", rt.method, rt.path)
		}
	}
}
