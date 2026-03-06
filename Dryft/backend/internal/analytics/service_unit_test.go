package analytics

import (
	"errors"
	"testing"
	"time"
)

func newAnalyticsUnitService() *Service {
	return &Service{
		eventBuffer: make([]Event, 0, 1000),
		bufferSize:  1000,
		stopChan:    make(chan struct{}),
	}
}

func TestIngestBatch_BuffersEvents(t *testing.T) {
	svc := newAnalyticsUnitService()
	now := time.Date(2026, 3, 3, 10, 0, 0, 0, time.UTC).UnixMilli()

	err := svc.IngestBatch(EventBatch{
		SessionID: "session-1",
		Events: []EventInput{
			{Name: "view", SessionID: "session-1", Timestamp: now, Properties: map[string]any{"screen": "discover"}},
			{Name: "click", SessionID: "session-1", Timestamp: now + 1, Properties: map[string]any{"target": "cta"}},
		},
	})
	if err != nil {
		t.Fatalf("ingest batch: %v", err)
	}

	if len(svc.eventBuffer) != 2 {
		t.Fatalf("expected 2 buffered events, got %d", len(svc.eventBuffer))
	}
	if svc.eventBuffer[0].SessionID != "session-1" || svc.eventBuffer[0].Name != "view" {
		t.Fatalf("unexpected buffered event: %+v", svc.eventBuffer[0])
	}
}

func TestIngestBatch_EmptyBatchIsNoop(t *testing.T) {
	svc := newAnalyticsUnitService()
	err := svc.IngestBatch(EventBatch{})
	if err != nil {
		t.Fatalf("expected empty batch to be accepted, got %v", err)
	}
	if len(svc.eventBuffer) != 0 {
		t.Fatalf("expected no buffered events for empty batch, got %d", len(svc.eventBuffer))
	}
}

func TestIngestBatch_ValidatesRequiredFields(t *testing.T) {
	svc := newAnalyticsUnitService()
	now := time.Now().UnixMilli()

	err := svc.IngestBatch(EventBatch{
		SessionID: "session-1",
		Events: []EventInput{
			{Name: "", SessionID: "session-1", Timestamp: now},
		},
	})
	if !errors.Is(err, ErrEventNameRequired) {
		t.Fatalf("expected ErrEventNameRequired, got %v", err)
	}
}

func TestIngestBatch_RespectsMaxBatchSize(t *testing.T) {
	svc := newAnalyticsUnitService()
	events := make([]EventInput, maxBatchSize+1)
	ts := time.Now().UnixMilli()
	for i := range events {
		events[i] = EventInput{
			Name:      "event",
			SessionID: "session-1",
			Timestamp: ts,
		}
	}

	err := svc.IngestBatch(EventBatch{SessionID: "session-1", Events: events})
	if !errors.Is(err, ErrBatchTooLarge) {
		t.Fatalf("expected ErrBatchTooLarge, got %v", err)
	}
}

func TestIngestBatch_UsesBatchSessionIDFallback(t *testing.T) {
	svc := newAnalyticsUnitService()
	now := time.Now().UnixMilli()

	err := svc.IngestBatch(EventBatch{
		SessionID: "batch-session",
		Events: []EventInput{
			{Name: "view", SessionID: "", Timestamp: now},
		},
	})
	if err != nil {
		t.Fatalf("unexpected ingest error: %v", err)
	}
	if len(svc.eventBuffer) != 1 {
		t.Fatalf("expected one buffered event, got %d", len(svc.eventBuffer))
	}
	if svc.eventBuffer[0].SessionID != "batch-session" {
		t.Fatalf("expected batch session fallback, got %q", svc.eventBuffer[0].SessionID)
	}
}

func TestIngestBatch_RejectsInvalidTimestamp(t *testing.T) {
	svc := newAnalyticsUnitService()

	err := svc.IngestBatch(EventBatch{
		SessionID: "session-1",
		Events: []EventInput{
			{Name: "view", SessionID: "session-1", Timestamp: 0},
		},
	})
	if !errors.Is(err, ErrEventTimeInvalid) {
		t.Fatalf("expected ErrEventTimeInvalid, got %v", err)
	}
}

func TestGetUserAnalytics_ReturnsErrorWhenDBUnavailable(t *testing.T) {
	svc := newAnalyticsUnitService()
	_, err := svc.GetUserAnalytics("new-user")
	if err == nil {
		t.Fatal("expected error when db is unavailable")
	}
}

func TestGetDailyMetrics_ValidatesDateRange(t *testing.T) {
	svc := newAnalyticsUnitService()
	start := time.Date(2026, 3, 3, 0, 0, 0, 0, time.UTC)
	end := start.Add(-time.Hour)

	_, err := svc.GetDailyMetrics(start, end)
	if !errors.Is(err, ErrInvalidDateRange) {
		t.Fatalf("expected ErrInvalidDateRange, got %v", err)
	}
}

func TestGetEventCounts_ValidatesDateRange(t *testing.T) {
	svc := newAnalyticsUnitService()
	start := time.Date(2026, 3, 3, 0, 0, 0, 0, time.UTC)
	end := start.Add(-time.Minute)

	_, err := svc.GetEventCounts(start, end, "")
	if !errors.Is(err, ErrInvalidDateRange) {
		t.Fatalf("expected ErrInvalidDateRange, got %v", err)
	}
}

func TestGetRecentEvents_ReturnsErrorWhenDBUnavailable(t *testing.T) {
	svc := newAnalyticsUnitService()
	_, err := svc.GetRecentEvents("user-1", -1)
	if err == nil {
		t.Fatal("expected error when db is unavailable")
	}
}
