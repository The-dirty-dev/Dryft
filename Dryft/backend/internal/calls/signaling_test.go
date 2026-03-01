package calls

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// mockCallRepository is a minimal in-memory implementation of CallRepository
// used to satisfy the interface without touching a real database.
type mockCallRepository struct {
	calls []*ActiveCall
}

func (m *mockCallRepository) CreateCall(_ context.Context, call *ActiveCall) error {
	m.calls = append(m.calls, call)
	return nil
}

func (m *mockCallRepository) UpdateCall(_ context.Context, call *ActiveCall) error {
	for i, c := range m.calls {
		if c.ID == call.ID {
			m.calls[i] = call
			return nil
		}
	}
	return nil
}

func (m *mockCallRepository) GetCallHistory(_ context.Context, _ uuid.UUID, _, _ int) ([]*ActiveCall, error) {
	return m.calls, nil
}

// newTestHub creates a SignalingHub backed by a mock repository.
func newTestHub() (*SignalingHub, *mockCallRepository) {
	repo := &mockCallRepository{}
	hub := NewSignalingHub(repo)
	return hub, repo
}

// newTestWSConn creates a throwaway WebSocket connection pair using httptest.
// It returns the server-side *websocket.Conn suitable for passing to
// RegisterConnection and a cleanup function that tears down the test server.
func newTestWSConn(t *testing.T) (*websocket.Conn, func()) {
	t.Helper()

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		// Keep the server-side alive until the test tears it down.
		// Reading drains any close frames so Close() does not block.
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}))

	url := "ws" + strings.TrimPrefix(srv.URL, "http")
	clientConn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		srv.Close()
		t.Fatalf("failed to dial test websocket: %v", err)
	}

	cleanup := func() {
		clientConn.Close()
		srv.Close()
	}

	// We use the client-side conn here because the SignalingHub stores a conn
	// and only calls WriteMessage / Close on it. The client-side conn satisfies
	// that usage without requiring us to plumb out the server-side conn.
	return clientConn, cleanup
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestNewSignalingHub(t *testing.T) {
	hub, _ := newTestHub()

	if hub == nil {
		t.Fatal("NewSignalingHub returned nil")
	}
	if hub.connections == nil {
		t.Error("expected connections map to be initialized")
	}
	if hub.activeCalls == nil {
		t.Error("expected activeCalls map to be initialized")
	}
	if hub.callRepo == nil {
		t.Error("expected callRepo to be set")
	}
}

func TestNewSignalingHub_NilRepo(t *testing.T) {
	hub := NewSignalingHub(nil)

	if hub == nil {
		t.Fatal("NewSignalingHub(nil) returned nil")
	}
	if hub.connections == nil {
		t.Error("expected connections map to be initialized even with nil repo")
	}
	if hub.activeCalls == nil {
		t.Error("expected activeCalls map to be initialized even with nil repo")
	}
	if hub.callRepo != nil {
		t.Error("expected callRepo to be nil when nil is passed")
	}
}

func TestRegisterConnection(t *testing.T) {
	hub, _ := newTestHub()
	userID := uuid.New()
	conn, cleanup := newTestWSConn(t)
	defer cleanup()

	hub.RegisterConnection(userID, conn)

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	stored, ok := hub.connections[userID]
	if !ok {
		t.Fatal("expected user to be in connections map after registration")
	}
	if stored != conn {
		t.Error("expected stored connection to match the registered connection")
	}
}

func TestRegisterConnection_ReplacesExisting(t *testing.T) {
	hub, _ := newTestHub()
	userID := uuid.New()

	conn1, cleanup1 := newTestWSConn(t)
	defer cleanup1()
	conn2, cleanup2 := newTestWSConn(t)
	defer cleanup2()

	hub.RegisterConnection(userID, conn1)
	hub.RegisterConnection(userID, conn2)

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	stored := hub.connections[userID]
	if stored != conn2 {
		t.Error("expected the second connection to replace the first")
	}
}

func TestRegisterConnection_MultipleUsers(t *testing.T) {
	hub, _ := newTestHub()
	user1 := uuid.New()
	user2 := uuid.New()

	conn1, cleanup1 := newTestWSConn(t)
	defer cleanup1()
	conn2, cleanup2 := newTestWSConn(t)
	defer cleanup2()

	hub.RegisterConnection(user1, conn1)
	hub.RegisterConnection(user2, conn2)

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	if len(hub.connections) != 2 {
		t.Errorf("expected 2 connections, got %d", len(hub.connections))
	}
	if hub.connections[user1] != conn1 {
		t.Error("expected user1's connection to be stored")
	}
	if hub.connections[user2] != conn2 {
		t.Error("expected user2's connection to be stored")
	}
}

func TestUnregisterConnection(t *testing.T) {
	hub, _ := newTestHub()
	userID := uuid.New()
	conn, cleanup := newTestWSConn(t)
	defer cleanup()

	hub.RegisterConnection(userID, conn)
	hub.UnregisterConnection(userID)

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	if _, ok := hub.connections[userID]; ok {
		t.Error("expected user to be removed from connections map after unregistration")
	}
}

func TestUnregisterConnection_NonExistentUser(t *testing.T) {
	hub, _ := newTestHub()
	nonExistent := uuid.New()

	// Should not panic when unregistering a user that was never registered.
	hub.UnregisterConnection(nonExistent)

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	if len(hub.connections) != 0 {
		t.Error("expected connections map to remain empty")
	}
}

func TestUnregisterConnection_CleansUpActiveCalls(t *testing.T) {
	hub, _ := newTestHub()
	caller := uuid.New()
	callee := uuid.New()
	callID := uuid.New()

	conn1, cleanup1 := newTestWSConn(t)
	defer cleanup1()
	conn2, cleanup2 := newTestWSConn(t)
	defer cleanup2()

	hub.RegisterConnection(caller, conn1)
	hub.RegisterConnection(callee, conn2)

	hub.mu.Lock()
	hub.activeCalls[callID] = &ActiveCall{
		ID:       callID,
		CallerID: caller,
		CalleeID: callee,
		State:    CallStateConnected,
	}
	hub.mu.Unlock()

	// This previously deadlocked because UnregisterConnection held a write lock
	// and called sendToUser which tried to acquire a read lock.
	done := make(chan struct{})
	go func() {
		hub.UnregisterConnection(caller)
		close(done)
	}()

	select {
	case <-done:
		// Success — no deadlock
	case <-time.After(2 * time.Second):
		t.Fatal("UnregisterConnection deadlocked during active call cleanup")
	}

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	if _, ok := hub.connections[caller]; ok {
		t.Error("expected caller to be removed from connections")
	}
	if len(hub.activeCalls) != 0 {
		t.Errorf("expected active calls to be cleaned up, got %d", len(hub.activeCalls))
	}
}

func TestUnregisterConnection_CleansUpMultipleCalls(t *testing.T) {
	hub, _ := newTestHub()
	user := uuid.New()
	other1 := uuid.New()
	other2 := uuid.New()

	conn, cleanup := newTestWSConn(t)
	defer cleanup()
	conn2, cleanup2 := newTestWSConn(t)
	defer cleanup2()
	conn3, cleanup3 := newTestWSConn(t)
	defer cleanup3()

	hub.RegisterConnection(user, conn)
	hub.RegisterConnection(other1, conn2)
	hub.RegisterConnection(other2, conn3)

	hub.mu.Lock()
	hub.activeCalls[uuid.New()] = &ActiveCall{
		ID:       uuid.New(),
		CallerID: user,
		CalleeID: other1,
		State:    CallStateRinging,
	}
	hub.activeCalls[uuid.New()] = &ActiveCall{
		ID:       uuid.New(),
		CallerID: other2,
		CalleeID: user,
		State:    CallStateConnected,
	}
	hub.mu.Unlock()

	done := make(chan struct{})
	go func() {
		hub.UnregisterConnection(user)
		close(done)
	}()

	select {
	case <-done:
		// No deadlock
	case <-time.After(2 * time.Second):
		t.Fatal("UnregisterConnection deadlocked with multiple active calls")
	}

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	if len(hub.activeCalls) != 0 {
		t.Errorf("expected all calls involving user to be cleaned up, got %d remaining", len(hub.activeCalls))
	}
}

func TestIsUserOnline(t *testing.T) {
	hub, _ := newTestHub()
	userID := uuid.New()
	conn, cleanup := newTestWSConn(t)
	defer cleanup()

	// Before registration
	if hub.IsUserOnline(userID) {
		t.Error("expected user to be offline before registration")
	}

	hub.RegisterConnection(userID, conn)

	// After registration
	if !hub.IsUserOnline(userID) {
		t.Error("expected user to be online after registration")
	}

	hub.UnregisterConnection(userID)

	// After unregistration
	if hub.IsUserOnline(userID) {
		t.Error("expected user to be offline after unregistration")
	}
}

func TestIsUserOnline_NonExistentUser(t *testing.T) {
	hub, _ := newTestHub()
	if hub.IsUserOnline(uuid.New()) {
		t.Error("expected non-existent user to be offline")
	}
}

func TestIsUserInCall_InitiallyFalse(t *testing.T) {
	hub, _ := newTestHub()
	userID := uuid.New()

	if hub.IsUserInCall(userID) {
		t.Error("expected IsUserInCall to return false when no calls are active")
	}
}

func TestIsUserInCall_ReturnsTrueForActiveParticipants(t *testing.T) {
	hub, _ := newTestHub()
	caller := uuid.New()
	callee := uuid.New()
	callID := uuid.New()

	hub.mu.Lock()
	hub.activeCalls[callID] = &ActiveCall{
		ID:       callID,
		CallerID: caller,
		CalleeID: callee,
		State:    CallStateRinging,
	}
	hub.mu.Unlock()

	if !hub.IsUserInCall(caller) {
		t.Error("expected IsUserInCall to return true for the caller")
	}
	if !hub.IsUserInCall(callee) {
		t.Error("expected IsUserInCall to return true for the callee")
	}
}

func TestIsUserInCall_ReturnsFalseForEndedCalls(t *testing.T) {
	hub, _ := newTestHub()
	caller := uuid.New()
	callee := uuid.New()
	callID := uuid.New()

	hub.mu.Lock()
	hub.activeCalls[callID] = &ActiveCall{
		ID:       callID,
		CallerID: caller,
		CalleeID: callee,
		State:    CallStateEnded,
		EndedAt:  time.Now(),
	}
	hub.mu.Unlock()

	if hub.IsUserInCall(caller) {
		t.Error("expected IsUserInCall to return false when call state is ended")
	}
	if hub.IsUserInCall(callee) {
		t.Error("expected IsUserInCall to return false when call state is ended")
	}
}

func TestIsUserInCall_ReturnsFalseForUnrelatedUser(t *testing.T) {
	hub, _ := newTestHub()
	caller := uuid.New()
	callee := uuid.New()
	bystander := uuid.New()
	callID := uuid.New()

	hub.mu.Lock()
	hub.activeCalls[callID] = &ActiveCall{
		ID:       callID,
		CallerID: caller,
		CalleeID: callee,
		State:    CallStateConnected,
	}
	hub.mu.Unlock()

	if hub.IsUserInCall(bystander) {
		t.Error("expected IsUserInCall to return false for a user not part of any call")
	}
}

func TestIsUserInCall_ConnectedState(t *testing.T) {
	hub, _ := newTestHub()
	caller := uuid.New()
	callee := uuid.New()
	callID := uuid.New()

	hub.mu.Lock()
	hub.activeCalls[callID] = &ActiveCall{
		ID:       callID,
		CallerID: caller,
		CalleeID: callee,
		State:    CallStateConnected,
	}
	hub.mu.Unlock()

	if !hub.IsUserInCall(caller) {
		t.Error("expected IsUserInCall to return true for caller in connected call")
	}
	if !hub.IsUserInCall(callee) {
		t.Error("expected IsUserInCall to return true for callee in connected call")
	}
}

func TestGetActiveCall_NilWhenNoCalls(t *testing.T) {
	hub, _ := newTestHub()
	callID := uuid.New()

	call := hub.GetActiveCall(callID)
	if call != nil {
		t.Error("expected GetActiveCall to return nil when no calls are active")
	}
}

func TestGetActiveCall_ReturnsCallByID(t *testing.T) {
	hub, _ := newTestHub()
	callID := uuid.New()
	expected := &ActiveCall{
		ID:           callID,
		CallerID:     uuid.New(),
		CalleeID:     uuid.New(),
		State:        CallStateRinging,
		VideoEnabled: true,
		StartedAt:    time.Now(),
	}

	hub.mu.Lock()
	hub.activeCalls[callID] = expected
	hub.mu.Unlock()

	call := hub.GetActiveCall(callID)
	if call == nil {
		t.Fatal("expected GetActiveCall to return a non-nil call")
	}
	if call.ID != callID {
		t.Errorf("expected call ID %s, got %s", callID, call.ID)
	}
	if call != expected {
		t.Error("expected GetActiveCall to return the same pointer as stored")
	}
}

func TestGetActiveCall_DoesNotReturnWrongCall(t *testing.T) {
	hub, _ := newTestHub()
	callID1 := uuid.New()
	callID2 := uuid.New()

	hub.mu.Lock()
	hub.activeCalls[callID1] = &ActiveCall{
		ID:    callID1,
		State: CallStateRinging,
	}
	hub.mu.Unlock()

	call := hub.GetActiveCall(callID2)
	if call != nil {
		t.Error("expected GetActiveCall to return nil for a non-existent call ID")
	}
}

func TestGetUserActiveCall_NilWhenNoCalls(t *testing.T) {
	hub, _ := newTestHub()
	userID := uuid.New()

	call := hub.GetUserActiveCall(userID)
	if call != nil {
		t.Error("expected GetUserActiveCall to return nil when no calls are active")
	}
}

func TestGetUserActiveCall_FindsCallForCaller(t *testing.T) {
	hub, _ := newTestHub()
	caller := uuid.New()
	callee := uuid.New()
	callID := uuid.New()

	hub.mu.Lock()
	hub.activeCalls[callID] = &ActiveCall{
		ID:       callID,
		CallerID: caller,
		CalleeID: callee,
		State:    CallStateConnected,
	}
	hub.mu.Unlock()

	call := hub.GetUserActiveCall(caller)
	if call == nil {
		t.Fatal("expected GetUserActiveCall to find an active call for the caller")
	}
	if call.ID != callID {
		t.Errorf("expected call ID %s, got %s", callID, call.ID)
	}
}

func TestGetUserActiveCall_FindsCallForCallee(t *testing.T) {
	hub, _ := newTestHub()
	caller := uuid.New()
	callee := uuid.New()
	callID := uuid.New()

	hub.mu.Lock()
	hub.activeCalls[callID] = &ActiveCall{
		ID:       callID,
		CallerID: caller,
		CalleeID: callee,
		State:    CallStateRinging,
	}
	hub.mu.Unlock()

	call := hub.GetUserActiveCall(callee)
	if call == nil {
		t.Fatal("expected GetUserActiveCall to find an active call for the callee")
	}
	if call.ID != callID {
		t.Errorf("expected call ID %s, got %s", callID, call.ID)
	}
}

func TestGetUserActiveCall_IgnoresEndedCalls(t *testing.T) {
	hub, _ := newTestHub()
	caller := uuid.New()
	callee := uuid.New()
	callID := uuid.New()

	hub.mu.Lock()
	hub.activeCalls[callID] = &ActiveCall{
		ID:       callID,
		CallerID: caller,
		CalleeID: callee,
		State:    CallStateEnded,
		EndedAt:  time.Now(),
	}
	hub.mu.Unlock()

	if call := hub.GetUserActiveCall(caller); call != nil {
		t.Error("expected GetUserActiveCall to return nil for an ended call (caller)")
	}
	if call := hub.GetUserActiveCall(callee); call != nil {
		t.Error("expected GetUserActiveCall to return nil for an ended call (callee)")
	}
}

func TestGetUserActiveCall_ReturnsNilForUnrelatedUser(t *testing.T) {
	hub, _ := newTestHub()
	caller := uuid.New()
	callee := uuid.New()
	bystander := uuid.New()
	callID := uuid.New()

	hub.mu.Lock()
	hub.activeCalls[callID] = &ActiveCall{
		ID:       callID,
		CallerID: caller,
		CalleeID: callee,
		State:    CallStateConnected,
	}
	hub.mu.Unlock()

	call := hub.GetUserActiveCall(bystander)
	if call != nil {
		t.Error("expected GetUserActiveCall to return nil for a user not in any call")
	}
}
