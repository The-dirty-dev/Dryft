package notifications

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestRateLimiter_CheckAndRecord(t *testing.T) {
	limits := map[NotificationType]RateLimitConfig{
		NotificationTypeNewMessage: {
			MaxPerWindow: 2,
			Window:       time.Hour,
			DedupeWindow: time.Hour,
		},
	}
	rl := NewRateLimiterWithConfig(limits)
	defer rl.Stop()

	userID := uuid.New()
	base := &Notification{
		Type:  NotificationTypeNewMessage,
		Title: "Alice",
		Body:  "hello",
		Data:  map[string]string{"match_id": "m1"},
	}

	result := rl.Check(userID, base)
	if !result.Allowed {
		t.Fatalf("expected first notification allowed, got %+v", result)
	}

	rl.Record(userID, base)

	dup := rl.Check(userID, base)
	if dup.Allowed || !dup.IsDuplicate || dup.RetryAfter <= 0 {
		t.Fatalf("expected duplicate rejection, got %+v", dup)
	}

	// Different content should not be treated as duplicate.
	second := &Notification{
		Type:  NotificationTypeNewMessage,
		Title: "Alice",
		Body:  "second message",
		Data:  map[string]string{"match_id": "m1"},
	}
	if res := rl.Check(userID, second); !res.Allowed {
		t.Fatalf("expected second distinct message allowed, got %+v", res)
	}
	rl.Record(userID, second)

	// Third distinct message exceeds MaxPerWindow.
	third := &Notification{
		Type:  NotificationTypeNewMessage,
		Title: "Alice",
		Body:  "third message",
		Data:  map[string]string{"match_id": "m1"},
	}
	limited := rl.Check(userID, third)
	if limited.Allowed || limited.Reason != "rate limit exceeded" || limited.RetryAfter <= 0 {
		t.Fatalf("expected rate-limit rejection, got %+v", limited)
	}
}

func TestRateLimiter_NoConfiguredLimitsAllows(t *testing.T) {
	rl := NewRateLimiterWithConfig(map[NotificationType]RateLimitConfig{})
	defer rl.Stop()

	res := rl.Check(uuid.New(), &Notification{
		Type:  NotificationTypeSystem,
		Title: "System",
		Body:  "Notice",
	})
	if !res.Allowed {
		t.Fatalf("expected allowed for unconfigured type, got %+v", res)
	}
}

func TestRateLimiter_GetStatsAndCleanup(t *testing.T) {
	limits := map[NotificationType]RateLimitConfig{
		NotificationTypeNewLike: {
			MaxPerWindow: 3,
			Window:       time.Hour,
			DedupeWindow: 0,
		},
	}
	rl := NewRateLimiterWithConfig(limits)
	defer rl.Stop()

	userID := uuid.New()
	typ := NotificationTypeNewLike

	sent, remaining, resetIn := rl.GetStats(userID, typ)
	if sent != 0 || remaining != 3 || resetIn != 0 {
		t.Fatalf("unexpected initial stats: sent=%d remaining=%d resetIn=%s", sent, remaining, resetIn)
	}

	notification := &Notification{
		Type:  typ,
		Title: "New like",
		Body:  "Someone liked you",
	}
	rl.Record(userID, notification)
	rl.Record(userID, notification)

	sent, remaining, resetIn = rl.GetStats(userID, typ)
	if sent != 2 || remaining != 1 || resetIn <= 0 {
		t.Fatalf("unexpected stats after records: sent=%d remaining=%d resetIn=%s", sent, remaining, resetIn)
	}

	// Inject a stale entry and ensure cleanup removes it.
	staleKey := uuid.NewString() + ":" + string(typ)
	rl.mu.Lock()
	rl.entries[staleKey] = &rateLimitEntry{
		timestamps: []time.Time{time.Now().Add(-3 * time.Hour)},
		lastSent:   time.Now().Add(-3 * time.Hour),
	}
	rl.mu.Unlock()

	rl.cleanup()

	rl.mu.RLock()
	_, exists := rl.entries[staleKey]
	rl.mu.RUnlock()
	if exists {
		t.Fatal("expected stale entry to be removed by cleanup")
	}
}

func TestRateLimiter_HashNotificationUsesKeyFields(t *testing.T) {
	rl := NewRateLimiter()
	defer rl.Stop()

	n1 := &Notification{
		Type:  NotificationTypeSystem,
		Title: "Call",
		Body:  "Incoming call",
		Data:  map[string]string{"call_id": "c1"},
	}
	n2 := &Notification{
		Type:  NotificationTypeSystem,
		Title: "Call",
		Body:  "Incoming call",
		Data:  map[string]string{"call_id": "c2"},
	}

	h1 := rl.hashNotification(n1)
	h2 := rl.hashNotification(n2)
	if h1 == h2 {
		t.Fatalf("expected different hashes for different call_id values: %s", h1)
	}
}
