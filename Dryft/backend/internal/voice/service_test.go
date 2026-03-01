package voice

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
)

func newTestService() *Service {
	return NewService()
}

// ---------------------------------------------------------------------------
// CreateSession
// ---------------------------------------------------------------------------

func TestCreateSession(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()

	session, err := svc.CreateSession(ctx, sessionID)
	if err != nil {
		t.Fatalf("CreateSession returned unexpected error: %v", err)
	}
	if session == nil {
		t.Fatal("CreateSession returned nil session")
	}
	if session.SessionID != sessionID {
		t.Errorf("expected session ID %v, got %v", sessionID, session.SessionID)
	}
	if session.Participants == nil {
		t.Error("expected Participants map to be initialized, got nil")
	}
	if len(session.Participants) != 0 {
		t.Errorf("expected 0 participants, got %d", len(session.Participants))
	}
	if session.CreatedAt.IsZero() {
		t.Error("expected CreatedAt to be set, got zero time")
	}
}

func TestCreateSession_Idempotent(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()

	first, err := svc.CreateSession(ctx, sessionID)
	if err != nil {
		t.Fatalf("first CreateSession returned error: %v", err)
	}

	second, err := svc.CreateSession(ctx, sessionID)
	if err != nil {
		t.Fatalf("second CreateSession returned error: %v", err)
	}

	if first != second {
		t.Error("expected CreateSession to return the same session pointer for the same ID")
	}
}

func TestCreateSession_DistinctIDs(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()

	s1, err := svc.CreateSession(ctx, uuid.New())
	if err != nil {
		t.Fatalf("CreateSession 1 error: %v", err)
	}
	s2, err := svc.CreateSession(ctx, uuid.New())
	if err != nil {
		t.Fatalf("CreateSession 2 error: %v", err)
	}

	if s1.SessionID == s2.SessionID {
		t.Error("two sessions created with different IDs should not share a SessionID")
	}
}

// ---------------------------------------------------------------------------
// JoinSession / LeaveSession
// ---------------------------------------------------------------------------

func TestJoinSession(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()
	userID := uuid.New()

	if _, err := svc.CreateSession(ctx, sessionID); err != nil {
		t.Fatalf("CreateSession error: %v", err)
	}

	if err := svc.JoinSession(ctx, sessionID, userID, "Alice"); err != nil {
		t.Fatalf("JoinSession returned unexpected error: %v", err)
	}

	// Verify the participant exists
	participants, err := svc.GetParticipants(ctx, sessionID)
	if err != nil {
		t.Fatalf("GetParticipants error: %v", err)
	}
	if len(participants) != 1 {
		t.Fatalf("expected 1 participant, got %d", len(participants))
	}
	if participants[0].UserID != userID {
		t.Errorf("expected participant user ID %v, got %v", userID, participants[0].UserID)
	}
	if participants[0].DisplayName != "Alice" {
		t.Errorf("expected display name 'Alice', got %q", participants[0].DisplayName)
	}
	if participants[0].IsSpeaking {
		t.Error("expected IsSpeaking to be false on join")
	}
	if participants[0].IsMuted {
		t.Error("expected IsMuted to be false on join")
	}
	if participants[0].JoinedAt.IsZero() {
		t.Error("expected JoinedAt to be set")
	}
}

func TestJoinSession_CreatesSessionIfNotExists(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()
	userID := uuid.New()

	// JoinSession should auto-create the session if it doesn't exist
	if err := svc.JoinSession(ctx, sessionID, userID, "Bob"); err != nil {
		t.Fatalf("JoinSession returned unexpected error: %v", err)
	}

	session, err := svc.GetSession(ctx, sessionID)
	if err != nil {
		t.Fatalf("GetSession returned error after JoinSession auto-create: %v", err)
	}
	if session == nil {
		t.Fatal("expected session to exist after JoinSession auto-create")
	}
}

func TestJoinSession_IdempotentSameSession(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()
	userID := uuid.New()

	if _, err := svc.CreateSession(ctx, sessionID); err != nil {
		t.Fatalf("CreateSession error: %v", err)
	}

	if err := svc.JoinSession(ctx, sessionID, userID, "Alice"); err != nil {
		t.Fatalf("first JoinSession error: %v", err)
	}
	// Joining the same session again should be a no-op (returns nil)
	if err := svc.JoinSession(ctx, sessionID, userID, "Alice"); err != nil {
		t.Fatalf("second JoinSession (same session) error: %v", err)
	}

	participants, err := svc.GetParticipants(ctx, sessionID)
	if err != nil {
		t.Fatalf("GetParticipants error: %v", err)
	}
	if len(participants) != 1 {
		t.Errorf("expected 1 participant after idempotent join, got %d", len(participants))
	}
}

func TestJoinSession_SwitchSession(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	session1 := uuid.New()
	session2 := uuid.New()
	userID := uuid.New()

	if _, err := svc.CreateSession(ctx, session1); err != nil {
		t.Fatalf("CreateSession 1 error: %v", err)
	}
	if _, err := svc.CreateSession(ctx, session2); err != nil {
		t.Fatalf("CreateSession 2 error: %v", err)
	}

	if err := svc.JoinSession(ctx, session1, userID, "Alice"); err != nil {
		t.Fatalf("JoinSession to session1 error: %v", err)
	}

	// Joining a different session should auto-leave the first
	if err := svc.JoinSession(ctx, session2, userID, "Alice"); err != nil {
		t.Fatalf("JoinSession to session2 error: %v", err)
	}

	// User should no longer be in session1
	if svc.IsUserInSession(ctx, session1, userID) {
		t.Error("expected user to have left session1 after joining session2")
	}
	if !svc.IsUserInSession(ctx, session2, userID) {
		t.Error("expected user to be in session2")
	}
}

func TestJoinSession_Full(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()

	if _, err := svc.CreateSession(ctx, sessionID); err != nil {
		t.Fatalf("CreateSession error: %v", err)
	}

	// Fill the session to capacity
	for i := 0; i < MaxParticipantsPerSession; i++ {
		userID := uuid.New()
		if err := svc.JoinSession(ctx, sessionID, userID, "User"); err != nil {
			t.Fatalf("JoinSession for user %d error: %v", i, err)
		}
	}

	// The next join should fail with ErrSessionFull
	extraUser := uuid.New()
	err := svc.JoinSession(ctx, sessionID, extraUser, "Extra")
	if !errors.Is(err, ErrSessionFull) {
		t.Errorf("expected ErrSessionFull, got %v", err)
	}
}

func TestLeaveSession(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()
	userID := uuid.New()

	if _, err := svc.CreateSession(ctx, sessionID); err != nil {
		t.Fatalf("CreateSession error: %v", err)
	}
	if err := svc.JoinSession(ctx, sessionID, userID, "Alice"); err != nil {
		t.Fatalf("JoinSession error: %v", err)
	}

	if err := svc.LeaveSession(ctx, sessionID, userID); err != nil {
		t.Fatalf("LeaveSession returned unexpected error: %v", err)
	}

	if svc.IsUserInSession(ctx, sessionID, userID) {
		t.Error("expected user to no longer be in session after leaving")
	}

	// Session with no participants should be cleaned up
	_, err := svc.GetSession(ctx, sessionID)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("expected ErrSessionNotFound for empty session, got %v", err)
	}
}

func TestLeaveSession_SessionNotFound(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()

	err := svc.LeaveSession(ctx, uuid.New(), uuid.New())
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("expected ErrSessionNotFound, got %v", err)
	}
}

func TestLeaveSession_NotInSession(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()
	member := uuid.New()
	stranger := uuid.New()

	if _, err := svc.CreateSession(ctx, sessionID); err != nil {
		t.Fatalf("CreateSession error: %v", err)
	}
	// Need at least one participant so the session exists
	if err := svc.JoinSession(ctx, sessionID, member, "Member"); err != nil {
		t.Fatalf("JoinSession error: %v", err)
	}

	err := svc.LeaveSession(ctx, sessionID, stranger)
	if !errors.Is(err, ErrNotInSession) {
		t.Errorf("expected ErrNotInSession, got %v", err)
	}
}

func TestLeaveSession_PartialEmpty(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()
	user1 := uuid.New()
	user2 := uuid.New()

	if _, err := svc.CreateSession(ctx, sessionID); err != nil {
		t.Fatalf("CreateSession error: %v", err)
	}
	if err := svc.JoinSession(ctx, sessionID, user1, "Alice"); err != nil {
		t.Fatalf("JoinSession user1 error: %v", err)
	}
	if err := svc.JoinSession(ctx, sessionID, user2, "Bob"); err != nil {
		t.Fatalf("JoinSession user2 error: %v", err)
	}

	// Leave with one user -- session should still exist
	if err := svc.LeaveSession(ctx, sessionID, user1); err != nil {
		t.Fatalf("LeaveSession error: %v", err)
	}

	session, err := svc.GetSession(ctx, sessionID)
	if err != nil {
		t.Fatalf("expected session to still exist with one remaining participant, got error: %v", err)
	}
	if len(session.Participants) != 1 {
		t.Errorf("expected 1 remaining participant, got %d", len(session.Participants))
	}
}

// ---------------------------------------------------------------------------
// GetParticipants
// ---------------------------------------------------------------------------

func TestGetParticipants_Empty(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()

	if _, err := svc.CreateSession(ctx, sessionID); err != nil {
		t.Fatalf("CreateSession error: %v", err)
	}

	participants, err := svc.GetParticipants(ctx, sessionID)
	if err != nil {
		t.Fatalf("GetParticipants returned unexpected error: %v", err)
	}
	if len(participants) != 0 {
		t.Errorf("expected 0 participants, got %d", len(participants))
	}
}

func TestGetParticipants_Multiple(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()

	if _, err := svc.CreateSession(ctx, sessionID); err != nil {
		t.Fatalf("CreateSession error: %v", err)
	}

	users := []struct {
		id   uuid.UUID
		name string
	}{
		{uuid.New(), "Alice"},
		{uuid.New(), "Bob"},
		{uuid.New(), "Carol"},
	}

	for _, u := range users {
		if err := svc.JoinSession(ctx, sessionID, u.id, u.name); err != nil {
			t.Fatalf("JoinSession for %s error: %v", u.name, err)
		}
	}

	participants, err := svc.GetParticipants(ctx, sessionID)
	if err != nil {
		t.Fatalf("GetParticipants error: %v", err)
	}
	if len(participants) != len(users) {
		t.Fatalf("expected %d participants, got %d", len(users), len(participants))
	}

	// Build a lookup so we don't depend on iteration order
	byID := make(map[uuid.UUID]Participant)
	for _, p := range participants {
		byID[p.UserID] = p
	}

	for _, u := range users {
		p, ok := byID[u.id]
		if !ok {
			t.Errorf("participant %s (id=%v) not found", u.name, u.id)
			continue
		}
		if p.DisplayName != u.name {
			t.Errorf("expected display name %q, got %q", u.name, p.DisplayName)
		}
	}
}

func TestGetParticipants_SessionNotFound(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()

	_, err := svc.GetParticipants(ctx, uuid.New())
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("expected ErrSessionNotFound, got %v", err)
	}
}

func TestGetParticipants_ReturnsCopy(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()
	userID := uuid.New()

	if _, err := svc.CreateSession(ctx, sessionID); err != nil {
		t.Fatalf("CreateSession error: %v", err)
	}
	if err := svc.JoinSession(ctx, sessionID, userID, "Alice"); err != nil {
		t.Fatalf("JoinSession error: %v", err)
	}

	participants, _ := svc.GetParticipants(ctx, sessionID)
	// Mutating the returned slice should not affect the service state
	participants[0].DisplayName = "MODIFIED"

	fresh, _ := svc.GetParticipants(ctx, sessionID)
	if fresh[0].DisplayName == "MODIFIED" {
		t.Error("GetParticipants should return copies, not references to internal state")
	}
}

// ---------------------------------------------------------------------------
// SetSpeakingState
// ---------------------------------------------------------------------------

func TestSetSpeakingState(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()
	userID := uuid.New()

	if _, err := svc.CreateSession(ctx, sessionID); err != nil {
		t.Fatalf("CreateSession error: %v", err)
	}
	if err := svc.JoinSession(ctx, sessionID, userID, "Alice"); err != nil {
		t.Fatalf("JoinSession error: %v", err)
	}

	// Set speaking to true
	if err := svc.SetSpeakingState(ctx, sessionID, userID, true); err != nil {
		t.Fatalf("SetSpeakingState(true) error: %v", err)
	}
	participants, _ := svc.GetParticipants(ctx, sessionID)
	if !participants[0].IsSpeaking {
		t.Error("expected IsSpeaking to be true")
	}

	// Set speaking back to false
	if err := svc.SetSpeakingState(ctx, sessionID, userID, false); err != nil {
		t.Fatalf("SetSpeakingState(false) error: %v", err)
	}
	participants, _ = svc.GetParticipants(ctx, sessionID)
	if participants[0].IsSpeaking {
		t.Error("expected IsSpeaking to be false")
	}
}

func TestSetSpeakingState_SessionNotFound(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()

	err := svc.SetSpeakingState(ctx, uuid.New(), uuid.New(), true)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("expected ErrSessionNotFound, got %v", err)
	}
}

func TestSetSpeakingState_NotInSession(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()
	member := uuid.New()

	if _, err := svc.CreateSession(ctx, sessionID); err != nil {
		t.Fatalf("CreateSession error: %v", err)
	}
	if err := svc.JoinSession(ctx, sessionID, member, "Member"); err != nil {
		t.Fatalf("JoinSession error: %v", err)
	}

	stranger := uuid.New()
	err := svc.SetSpeakingState(ctx, sessionID, stranger, true)
	if !errors.Is(err, ErrNotInSession) {
		t.Errorf("expected ErrNotInSession, got %v", err)
	}
}

// ---------------------------------------------------------------------------
// SetMutedState
// ---------------------------------------------------------------------------

func TestSetMutedState(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()
	userID := uuid.New()

	if _, err := svc.CreateSession(ctx, sessionID); err != nil {
		t.Fatalf("CreateSession error: %v", err)
	}
	if err := svc.JoinSession(ctx, sessionID, userID, "Alice"); err != nil {
		t.Fatalf("JoinSession error: %v", err)
	}

	// Mute
	if err := svc.SetMutedState(ctx, sessionID, userID, true); err != nil {
		t.Fatalf("SetMutedState(true) error: %v", err)
	}
	participants, _ := svc.GetParticipants(ctx, sessionID)
	if !participants[0].IsMuted {
		t.Error("expected IsMuted to be true")
	}

	// Unmute
	if err := svc.SetMutedState(ctx, sessionID, userID, false); err != nil {
		t.Fatalf("SetMutedState(false) error: %v", err)
	}
	participants, _ = svc.GetParticipants(ctx, sessionID)
	if participants[0].IsMuted {
		t.Error("expected IsMuted to be false after unmuting")
	}
}

func TestSetMutedState_ClearsSpeaking(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()
	userID := uuid.New()

	if _, err := svc.CreateSession(ctx, sessionID); err != nil {
		t.Fatalf("CreateSession error: %v", err)
	}
	if err := svc.JoinSession(ctx, sessionID, userID, "Alice"); err != nil {
		t.Fatalf("JoinSession error: %v", err)
	}

	// Start speaking, then mute -- muting should clear speaking
	if err := svc.SetSpeakingState(ctx, sessionID, userID, true); err != nil {
		t.Fatalf("SetSpeakingState(true) error: %v", err)
	}
	if err := svc.SetMutedState(ctx, sessionID, userID, true); err != nil {
		t.Fatalf("SetMutedState(true) error: %v", err)
	}

	participants, _ := svc.GetParticipants(ctx, sessionID)
	if participants[0].IsSpeaking {
		t.Error("expected IsSpeaking to be false after muting")
	}
	if !participants[0].IsMuted {
		t.Error("expected IsMuted to be true")
	}
}

func TestSetMutedState_SessionNotFound(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()

	err := svc.SetMutedState(ctx, uuid.New(), uuid.New(), true)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("expected ErrSessionNotFound, got %v", err)
	}
}

func TestSetMutedState_NotInSession(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()
	member := uuid.New()

	if _, err := svc.CreateSession(ctx, sessionID); err != nil {
		t.Fatalf("CreateSession error: %v", err)
	}
	if err := svc.JoinSession(ctx, sessionID, member, "Member"); err != nil {
		t.Fatalf("JoinSession error: %v", err)
	}

	stranger := uuid.New()
	err := svc.SetMutedState(ctx, sessionID, stranger, true)
	if !errors.Is(err, ErrNotInSession) {
		t.Errorf("expected ErrNotInSession, got %v", err)
	}
}

// ---------------------------------------------------------------------------
// CleanupSession (CloseSession)
// ---------------------------------------------------------------------------

func TestCleanupSession(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()
	user1 := uuid.New()
	user2 := uuid.New()

	if _, err := svc.CreateSession(ctx, sessionID); err != nil {
		t.Fatalf("CreateSession error: %v", err)
	}
	if err := svc.JoinSession(ctx, sessionID, user1, "Alice"); err != nil {
		t.Fatalf("JoinSession user1 error: %v", err)
	}
	if err := svc.JoinSession(ctx, sessionID, user2, "Bob"); err != nil {
		t.Fatalf("JoinSession user2 error: %v", err)
	}

	if err := svc.CleanupSession(ctx, sessionID); err != nil {
		t.Fatalf("CleanupSession returned unexpected error: %v", err)
	}

	// Session should be gone
	_, err := svc.GetSession(ctx, sessionID)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("expected ErrSessionNotFound after cleanup, got %v", err)
	}

	// Users should no longer be mapped to any session
	if _, ok := svc.GetUserSession(ctx, user1); ok {
		t.Error("expected user1 to have no session after cleanup")
	}
	if _, ok := svc.GetUserSession(ctx, user2); ok {
		t.Error("expected user2 to have no session after cleanup")
	}
}

func TestCleanupSession_NotFound(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()

	err := svc.CleanupSession(ctx, uuid.New())
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("expected ErrSessionNotFound, got %v", err)
	}
}

func TestCleanupSession_EmptySession(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()

	if _, err := svc.CreateSession(ctx, sessionID); err != nil {
		t.Fatalf("CreateSession error: %v", err)
	}

	// Cleanup an empty session should succeed
	if err := svc.CleanupSession(ctx, sessionID); err != nil {
		t.Fatalf("CleanupSession on empty session returned error: %v", err)
	}

	_, err := svc.GetSession(ctx, sessionID)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("expected ErrSessionNotFound after cleanup, got %v", err)
	}
}

// ---------------------------------------------------------------------------
// Helper method coverage: IsUserInSession, GetUserSession, GetActiveSessions
// ---------------------------------------------------------------------------

func TestIsUserInSession(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()
	userID := uuid.New()

	if svc.IsUserInSession(ctx, sessionID, userID) {
		t.Error("expected user NOT to be in session before joining")
	}

	if _, err := svc.CreateSession(ctx, sessionID); err != nil {
		t.Fatalf("CreateSession error: %v", err)
	}
	if err := svc.JoinSession(ctx, sessionID, userID, "Alice"); err != nil {
		t.Fatalf("JoinSession error: %v", err)
	}

	if !svc.IsUserInSession(ctx, sessionID, userID) {
		t.Error("expected user to be in session after joining")
	}

	// Check against a different session
	otherSession := uuid.New()
	if svc.IsUserInSession(ctx, otherSession, userID) {
		t.Error("expected user NOT to be in a different session")
	}
}

func TestGetUserSession(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()
	sessionID := uuid.New()
	userID := uuid.New()

	_, ok := svc.GetUserSession(ctx, userID)
	if ok {
		t.Error("expected no session before joining")
	}

	if _, err := svc.CreateSession(ctx, sessionID); err != nil {
		t.Fatalf("CreateSession error: %v", err)
	}
	if err := svc.JoinSession(ctx, sessionID, userID, "Alice"); err != nil {
		t.Fatalf("JoinSession error: %v", err)
	}

	gotID, ok := svc.GetUserSession(ctx, userID)
	if !ok {
		t.Fatal("expected to find a session for the user")
	}
	if gotID != sessionID {
		t.Errorf("expected session %v, got %v", sessionID, gotID)
	}
}

func TestGetActiveSessions(t *testing.T) {
	svc := newTestService()
	ctx := context.Background()

	// No sessions initially
	sessions := svc.GetActiveSessions(ctx)
	if len(sessions) != 0 {
		t.Errorf("expected 0 active sessions, got %d", len(sessions))
	}

	id1 := uuid.New()
	id2 := uuid.New()
	if _, err := svc.CreateSession(ctx, id1); err != nil {
		t.Fatalf("CreateSession 1 error: %v", err)
	}
	if _, err := svc.CreateSession(ctx, id2); err != nil {
		t.Fatalf("CreateSession 2 error: %v", err)
	}

	sessions = svc.GetActiveSessions(ctx)
	if len(sessions) != 2 {
		t.Fatalf("expected 2 active sessions, got %d", len(sessions))
	}

	// Participants should be nil in list view
	for i := range sessions {
		if sessions[i].Participants != nil {
			t.Errorf("expected Participants to be nil in list view for session %v", sessions[i].SessionID)
		}
	}
}
