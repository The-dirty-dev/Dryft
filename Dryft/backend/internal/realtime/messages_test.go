package realtime

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"
)

func TestNewEnvelope_WithPayloadRoundTrip(t *testing.T) {
	conversationID := uuid.New()
	payload := SendMessagePayload{
		ConversationID: conversationID,
		Type:           "text",
		Content:        "hello",
		ClientID:       "client-1",
	}

	env, err := NewEnvelope(EventTypeSendMessage, payload)
	if err != nil {
		t.Fatalf("new envelope: %v", err)
	}

	if env.Type != EventTypeSendMessage {
		t.Fatalf("expected send_message type, got %s", env.Type)
	}
	if env.Timestamp == 0 {
		t.Fatal("expected non-zero timestamp")
	}

	var decoded SendMessagePayload
	if err := json.Unmarshal(env.Payload, &decoded); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}
	if decoded.ConversationID != conversationID || decoded.Content != "hello" {
		t.Fatalf("unexpected decoded payload: %+v", decoded)
	}
}

func TestNewEnvelope_NilPayload(t *testing.T) {
	env, err := NewEnvelope(EventTypePing, nil)
	if err != nil {
		t.Fatalf("new envelope: %v", err)
	}
	if len(env.Payload) != 0 {
		t.Fatalf("expected empty payload for nil input, got %q", string(env.Payload))
	}
}

func TestEnvelope_JSONRoundTrip_MultipleEventPayloads(t *testing.T) {
	tests := []struct {
		name    string
		evt     EventType
		payload any
	}{
		{
			name: "typing",
			evt:  EventTypeTypingIndicator,
			payload: TypingIndicatorPayload{
				ConversationID: uuid.New(),
				UserID:         uuid.New(),
				IsTyping:       true,
			},
		},
		{
			name: "presence",
			evt:  EventTypePresenceUpdate,
			payload: PresencePayload{
				UserID:   uuid.New(),
				IsOnline: true,
			},
		},
		{
			name: "call-signal",
			evt:  EventTypeCallCandidate,
			payload: CallCandidatePayload{
				CallID:    "call-1",
				Candidate: json.RawMessage(`{"candidate":"abc"}`),
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			env, err := NewEnvelope(tc.evt, tc.payload)
			if err != nil {
				t.Fatalf("new envelope: %v", err)
			}

			bytes, err := json.Marshal(env)
			if err != nil {
				t.Fatalf("marshal envelope: %v", err)
			}

			var decoded Envelope
			if err := json.Unmarshal(bytes, &decoded); err != nil {
				t.Fatalf("unmarshal envelope: %v", err)
			}
			if decoded.Type != tc.evt {
				t.Fatalf("expected event type %s, got %s", tc.evt, decoded.Type)
			}
			if len(decoded.Payload) == 0 {
				t.Fatalf("expected payload for %s event", tc.name)
			}
		})
	}
}
