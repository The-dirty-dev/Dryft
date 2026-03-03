package realtime

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
)

func benchmarkHubBroadcastToN(b *testing.B, n int) {
	b.Helper()
	b.ReportAllocs()

	h := NewHub()
	userID := uuid.New()
	envelope, err := NewEnvelope(EventTypeNewMessage, map[string]any{"text": "hello"})
	if err != nil {
		b.Fatalf("new envelope: %v", err)
	}

	clients := make([]*Client, 0, n)
	h.clients[userID] = make(map[*Client]bool, n)
	for i := 0; i < n; i++ {
		c := &Client{UserID: userID, send: make(chan *Envelope, 4)}
		h.clients[userID][c] = true
		clients = append(clients, c)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		h.broadcastToUser(userID, envelope)
		for _, c := range clients {
			select {
			case <-c.send:
			default:
			}
		}
	}
}

func BenchmarkHubBroadcast10Clients(b *testing.B) {
	benchmarkHubBroadcastToN(b, 10)
}

func BenchmarkHubBroadcast100Clients(b *testing.B) {
	benchmarkHubBroadcastToN(b, 100)
}

func BenchmarkHubBroadcast1000Clients(b *testing.B) {
	benchmarkHubBroadcastToN(b, 1000)
}

func BenchmarkMessageParsing(b *testing.B) {
	b.ReportAllocs()
	payload := []byte(`{"type":"typing_start","payload":{"conversation_id":"550e8400-e29b-41d4-a716-446655440000"},"ts":1700000000000}`)
	for i := 0; i < b.N; i++ {
		var env Envelope
		if err := json.Unmarshal(payload, &env); err != nil {
			b.Fatalf("unmarshal envelope: %v", err)
		}
	}
}

func BenchmarkClientRegistryLookup(b *testing.B) {
	b.ReportAllocs()
	h := NewHub()
	ids := make([]uuid.UUID, 1000)
	for i := range ids {
		id := uuid.New()
		ids[i] = id
		h.presence[id] = &PresenceInfo{IsOnline: i%2 == 0, LastSeen: time.Now()}
	}

	for i := 0; i < b.N; i++ {
		_ = h.IsUserOnline(ids[i%len(ids)])
	}
}
