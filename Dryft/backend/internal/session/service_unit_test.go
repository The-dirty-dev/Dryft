package session

import "testing"

func TestNewService(t *testing.T) {
	svc := NewService(nil, nil)
	if svc == nil {
		t.Fatal("expected non-nil service")
	}
	if svc.db != nil {
		t.Fatal("expected nil db when created with nil")
	}
	if svc.hub != nil {
		t.Fatal("expected nil hub when created with nil")
	}
}

func TestSessionErrors(t *testing.T) {
	tests := map[error]string{
		ErrSessionNotFound:    "session not found",
		ErrSessionExpired:     "session has expired",
		ErrSessionFull:        "session is full",
		ErrAlreadyInSession:   "already in session",
		ErrNotInSession:       "not in session",
		ErrNotSessionHost:     "not session host",
		ErrInvalidSessionCode: "invalid session code",
		ErrPermissionDenied:   "permission denied",
	}
	for err, expected := range tests {
		if err.Error() != expected {
			t.Fatalf("expected %q, got %q", expected, err.Error())
		}
	}
}
