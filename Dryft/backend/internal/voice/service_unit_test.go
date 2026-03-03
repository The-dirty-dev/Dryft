package voice

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
)

func TestJoinSession_EnforcesCapacity(t *testing.T) {
	svc := NewService()
	sessionID := uuid.New()
	svc.CreateSession(context.Background(), sessionID)

	for i := 0; i < MaxParticipantsPerSession; i++ {
		if err := svc.JoinSession(context.Background(), sessionID, uuid.New(), "user"); err != nil {
			t.Fatalf("unexpected join error at slot %d: %v", i, err)
		}
	}

	err := svc.JoinSession(context.Background(), sessionID, uuid.New(), "overflow")
	if !errors.Is(err, ErrSessionFull) {
		t.Fatalf("expected ErrSessionFull, got %v", err)
	}
}

func TestLeaveSession_RemovesParticipant(t *testing.T) {
	svc := NewService()
	sessionID := uuid.New()
	userID := uuid.New()
	svc.CreateSession(context.Background(), sessionID)

	if err := svc.JoinSession(context.Background(), sessionID, userID, "alice"); err != nil {
		t.Fatalf("join session: %v", err)
	}
	if err := svc.LeaveSession(context.Background(), sessionID, userID); err != nil {
		t.Fatalf("leave session: %v", err)
	}

	if svc.IsUserInSession(context.Background(), sessionID, userID) {
		t.Fatal("expected user to be removed from session")
	}
}
