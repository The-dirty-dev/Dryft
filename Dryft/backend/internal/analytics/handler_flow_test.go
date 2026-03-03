package analytics

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
)

type mockAnalyticsHandlerService struct {
	ingestBatchFn    func(batch EventBatch) error
	getUserFn        func(userID string) (*UserAnalytics, error)
	getDailyFn       func(startDate, endDate time.Time) ([]DailyMetrics, error)
	getEventCountsFn func(startDate, endDate time.Time, eventName string) ([]EventMetrics, error)
	getTopEventsFn   func(days int, limit int) ([]struct {
		Name  string
		Count int
	}, error)
	getRecentEventsFn func(userID string, limit int) ([]Event, error)
}

func (m *mockAnalyticsHandlerService) IngestBatch(batch EventBatch) error {
	if m.ingestBatchFn == nil {
		return nil
	}
	return m.ingestBatchFn(batch)
}
func (m *mockAnalyticsHandlerService) GetUserAnalytics(userID string) (*UserAnalytics, error) {
	if m.getUserFn == nil {
		return &UserAnalytics{UserID: userID}, nil
	}
	return m.getUserFn(userID)
}
func (m *mockAnalyticsHandlerService) GetDailyMetrics(startDate, endDate time.Time) ([]DailyMetrics, error) {
	if m.getDailyFn == nil {
		return []DailyMetrics{}, nil
	}
	return m.getDailyFn(startDate, endDate)
}
func (m *mockAnalyticsHandlerService) GetEventCounts(startDate, endDate time.Time, eventName string) ([]EventMetrics, error) {
	if m.getEventCountsFn == nil {
		return []EventMetrics{}, nil
	}
	return m.getEventCountsFn(startDate, endDate, eventName)
}
func (m *mockAnalyticsHandlerService) GetTopEvents(days int, limit int) ([]struct {
	Name  string
	Count int
}, error) {
	if m.getTopEventsFn == nil {
		return []struct {
			Name  string
			Count int
		}{}, nil
	}
	return m.getTopEventsFn(days, limit)
}
func (m *mockAnalyticsHandlerService) GetRecentEvents(userID string, limit int) ([]Event, error) {
	if m.getRecentEventsFn == nil {
		return []Event{}, nil
	}
	return m.getRecentEventsFn(userID, limit)
}

func TestIngestEvents_AcceptsBatch(t *testing.T) {
	h := &Handler{
		service: &mockAnalyticsHandlerService{
			ingestBatchFn: func(batch EventBatch) error {
				if len(batch.Events) != 2 {
					t.Fatalf("expected 2 events, got %d", len(batch.Events))
				}
				return nil
			},
		},
	}

	body := `{"events":[{"name":"app_open","timestamp":1700000000000},{"name":"tap","timestamp":1700000001000}]}`
	req := httptest.NewRequest(http.MethodPost, "/analytics/events", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	h.IngestEvents(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d", rec.Code)
	}
}

func TestGetUserAnalytics_Success(t *testing.T) {
	h := &Handler{
		service: &mockAnalyticsHandlerService{
			getUserFn: func(userID string) (*UserAnalytics, error) {
				return &UserAnalytics{UserID: userID, TotalEvents: 10}, nil
			},
		},
	}

	r := chi.NewRouter()
	r.Get("/analytics/user/{userId}", h.GetUserAnalytics)
	req := httptest.NewRequest(http.MethodGet, "/analytics/user/u-1", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestGetDailyMetrics_WithDateRange(t *testing.T) {
	h := &Handler{
		service: &mockAnalyticsHandlerService{
			getDailyFn: func(startDate, endDate time.Time) ([]DailyMetrics, error) {
				if startDate.IsZero() || endDate.IsZero() {
					t.Fatalf("expected parsed dates")
				}
				return []DailyMetrics{{Date: startDate, ActiveUsers: 5}}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/analytics/metrics/daily?start=2026-03-01&end=2026-03-03", nil)
	rec := httptest.NewRecorder()
	h.GetDailyMetrics(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if _, ok := body["metrics"]; !ok {
		t.Fatalf("missing metrics key")
	}
}

func TestGetEventCounts_Success(t *testing.T) {
	h := &Handler{
		service: &mockAnalyticsHandlerService{
			getEventCountsFn: func(startDate, endDate time.Time, eventName string) ([]EventMetrics, error) {
				if eventName != "tap" {
					t.Fatalf("expected event filter tap, got %q", eventName)
				}
				return []EventMetrics{{EventName: "tap", Count: 42}}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/analytics/metrics/events?event=tap", nil)
	rec := httptest.NewRecorder()
	h.GetEventCounts(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestGetTopEvents_Defaults(t *testing.T) {
	h := &Handler{
		service: &mockAnalyticsHandlerService{
			getTopEventsFn: func(days int, limit int) ([]struct {
				Name  string
				Count int
			}, error) {
				if days != 7 || limit != 20 {
					t.Fatalf("expected defaults days=7 limit=20, got days=%d limit=%d", days, limit)
				}
				return []struct {
					Name  string
					Count int
				}{
					{Name: "app_open", Count: 100},
				}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/analytics/metrics/top-events", nil)
	rec := httptest.NewRecorder()
	h.GetTopEvents(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestGetRecentEvents_DefaultLimit(t *testing.T) {
	h := &Handler{
		service: &mockAnalyticsHandlerService{
			getRecentEventsFn: func(userID string, limit int) ([]Event, error) {
				if userID != "u-123" {
					t.Fatalf("unexpected user id: %s", userID)
				}
				if limit != 50 {
					t.Fatalf("expected default limit 50, got %d", limit)
				}
				return []Event{{Name: "match_created"}}, nil
			},
		},
	}

	r := chi.NewRouter()
	r.Get("/analytics/events/recent/{userId}", h.GetRecentEvents)

	req := httptest.NewRequest(http.MethodGet, "/analytics/events/recent/u-123", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestGetDashboardSummary_Aggregates(t *testing.T) {
	h := &Handler{
		service: &mockAnalyticsHandlerService{
			getDailyFn: func(startDate, endDate time.Time) ([]DailyMetrics, error) {
				return []DailyMetrics{{
					Date:        startDate,
					ActiveUsers: 5,
					Sessions:    8,
					Matches:     2,
					Messages:    11,
					Revenue:     9.5,
				}}, nil
			},
			getTopEventsFn: func(days int, limit int) ([]struct {
				Name  string
				Count int
			}, error) {
				return []struct {
					Name  string
					Count int
				}{
					{Name: "app_open", Count: 100},
					{Name: "tap", Count: 80},
				}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/analytics/dashboard", nil)
	rec := httptest.NewRecorder()
	h.GetDashboardSummary(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var summary DashboardSummary
	if err := json.NewDecoder(rec.Body).Decode(&summary); err != nil {
		t.Fatalf("decode summary: %v", err)
	}
	if len(summary.TopEvents) != 2 {
		t.Fatalf("expected 2 top events, got %d", len(summary.TopEvents))
	}
	if summary.Week.TotalSessions == 0 {
		t.Fatalf("expected non-zero week sessions")
	}
}

func TestGetRecentEvents_ServiceError(t *testing.T) {
	h := &Handler{
		service: &mockAnalyticsHandlerService{
			getRecentEventsFn: func(userID string, limit int) ([]Event, error) {
				return nil, errors.New("boom")
			},
		},
	}

	r := chi.NewRouter()
	r.Get("/analytics/events/recent/{userId}", h.GetRecentEvents)

	req := httptest.NewRequest(http.MethodGet, "/analytics/events/recent/u-err?limit=10", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}
}
