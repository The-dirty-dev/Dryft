package calls

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestNullTime(t *testing.T) {
	if got := nullTime(time.Time{}); got != nil {
		t.Fatal("expected nil for zero time")
	}

	now := time.Now().UTC()
	got := nullTime(now)
	if got == nil {
		t.Fatal("expected non-nil for non-zero time")
	}
	if !got.Equal(now) {
		t.Fatalf("expected %s, got %s", now, *got)
	}
}

func TestServiceUnit_NewSignalingHub_InitializesEmptyState(t *testing.T) {
	hub := NewSignalingHub(nil)
	if hub == nil {
		t.Fatal("expected non-nil hub")
	}
	if len(hub.connections) != 0 {
		t.Fatalf("expected no connections, got %d", len(hub.connections))
	}
	if len(hub.activeCalls) != 0 {
		t.Fatalf("expected no active calls, got %d", len(hub.activeCalls))
	}
}

func TestServiceUnit_RegisterConnection_AddsUserToHub(t *testing.T) {
	hub := NewSignalingHub(nil)
	userID := uuid.New()
	conn, cleanup := newTestWSConn(t)
	defer cleanup()

	hub.RegisterConnection(userID, conn)

	if !hub.IsUserOnline(userID) {
		t.Fatal("expected user to be online after register")
	}
}

func TestServiceUnit_UnregisterConnection_RemovesUser(t *testing.T) {
	hub := NewSignalingHub(nil)
	userID := uuid.New()
	conn, cleanup := newTestWSConn(t)
	defer cleanup()

	hub.RegisterConnection(userID, conn)
	hub.UnregisterConnection(userID)

	if hub.IsUserOnline(userID) {
		t.Fatal("expected user to be offline after unregister")
	}
}

func TestServiceUnit_IsUserInCall_FalseWhenNotInCall(t *testing.T) {
	hub := NewSignalingHub(nil)
	if hub.IsUserInCall(uuid.New()) {
		t.Fatal("expected IsUserInCall to be false for user with no calls")
	}
}

func TestServiceUnit_GetActiveCall_ReturnsNilForUnknown(t *testing.T) {
	hub := NewSignalingHub(nil)
	if call := hub.GetActiveCall(uuid.New()); call != nil {
		t.Fatalf("expected nil active call, got %+v", call)
	}
}

func TestServiceUnit_GetUserActiveCall_ReturnsNilWhenIdle(t *testing.T) {
	hub := NewSignalingHub(nil)
	if call := hub.GetUserActiveCall(uuid.New()); call != nil {
		t.Fatalf("expected nil user active call, got %+v", call)
	}
}
