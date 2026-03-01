package analytics

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

func TestRegisterRoutes_Structure(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	h.RegisterRoutes(r)

	routes := []struct {
		method string
		path   string
	}{
		{"POST", "/analytics/events"},
		{"GET", "/analytics/user/{userId}"},
		{"GET", "/analytics/metrics/daily"},
		{"GET", "/analytics/metrics/events"},
		{"GET", "/analytics/metrics/top-events"},
		{"GET", "/analytics/events/recent/{userId}"},
		{"GET", "/analytics/dashboard"},
	}

	for _, rt := range routes {
		rctx := chi.NewRouteContext()
		if !r.Match(rctx, rt.method, rt.path) {
			t.Errorf("route %s %s not registered", rt.method, rt.path)
		}
	}
}

// ---------------------------------------------------------------------------
// IngestEvents – validation
// ---------------------------------------------------------------------------

func TestIngestEvents_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)

	req := httptest.NewRequest("POST", "/analytics/events", strings.NewReader(`not-json`))
	rr := httptest.NewRecorder()

	h.IngestEvents(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// DashboardSummary struct
// ---------------------------------------------------------------------------

func TestDashboardSummary_JSONMarshal(t *testing.T) {
	summary := DashboardSummary{
		Today: DayStats{
			ActiveUsers: 100,
			Sessions:    50,
		},
		Week: WeekStats{
			TotalUsers:     700,
			AvgSessionsDay: 42.5,
		},
	}

	data, err := json.Marshal(summary)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var decoded DashboardSummary
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if decoded.Today.ActiveUsers != 100 {
		t.Errorf("expected 100 active users, got %d", decoded.Today.ActiveUsers)
	}
	if decoded.Week.AvgSessionsDay != 42.5 {
		t.Errorf("expected 42.5 avg, got %f", decoded.Week.AvgSessionsDay)
	}
}

// ---------------------------------------------------------------------------
// EventBatch / EventInput structs
// ---------------------------------------------------------------------------

func TestEventBatch_JSONDecode(t *testing.T) {
	body := `{
		"events": [
			{"name": "screen_view", "properties": {"screen": "home"}, "timestamp": 1700000000},
			{"name": "button_tap", "properties": {"button": "like"}, "timestamp": 1700000001}
		],
		"userId": "user123",
		"sessionId": "sess456",
		"timestamp": 1700000000
	}`

	var batch EventBatch
	if err := json.Unmarshal([]byte(body), &batch); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if len(batch.Events) != 2 {
		t.Errorf("expected 2 events, got %d", len(batch.Events))
	}
	if batch.Events[0].Name != "screen_view" {
		t.Errorf("expected 'screen_view', got %q", batch.Events[0].Name)
	}
	if batch.SessionID != "sess456" {
		t.Errorf("expected 'sess456', got %q", batch.SessionID)
	}
	if batch.UserID == nil || *batch.UserID != "user123" {
		t.Errorf("expected userId 'user123'")
	}
}

func TestEventBatch_EmptyEvents(t *testing.T) {
	body := `{"events":[]}`
	var batch EventBatch
	if err := json.Unmarshal([]byte(body), &batch); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if len(batch.Events) != 0 {
		t.Errorf("expected 0 events, got %d", len(batch.Events))
	}
}

// ---------------------------------------------------------------------------
// DayStats / WeekStats / EventCount
// ---------------------------------------------------------------------------

func TestDayStats_JSONRoundTrip(t *testing.T) {
	ds := DayStats{
		ActiveUsers: 50,
		NewUsers:    10,
		Sessions:    200,
		Matches:     30,
		Messages:    500,
		VRSessions:  15,
		Revenue:     99.99,
	}

	data, _ := json.Marshal(ds)
	var decoded DayStats
	json.Unmarshal(data, &decoded)

	if decoded.Revenue != 99.99 {
		t.Errorf("expected 99.99, got %f", decoded.Revenue)
	}
	if decoded.VRSessions != 15 {
		t.Errorf("expected 15 VR sessions, got %d", decoded.VRSessions)
	}
}

func TestEventCount_JSON(t *testing.T) {
	ec := EventCount{Name: "page_view", Count: 42}
	data, _ := json.Marshal(ec)
	var decoded EventCount
	json.Unmarshal(data, &decoded)

	if decoded.Name != "page_view" || decoded.Count != 42 {
		t.Errorf("expected page_view/42, got %s/%d", decoded.Name, decoded.Count)
	}
}
