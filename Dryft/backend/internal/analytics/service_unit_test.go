package analytics

import (
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
