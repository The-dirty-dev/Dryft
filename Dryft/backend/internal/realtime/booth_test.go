package realtime

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
)

func processUserBroadcasts(t *testing.T, hub *Hub, expected int) {
	t.Helper()
	for i := 0; i < expected; i++ {
		select {
		case msg := <-hub.userBroadcast:
			hub.broadcastToUser(msg.UserID, msg.Message)
		case <-time.After(time.Second):
			t.Fatalf("timed out waiting for user broadcast %d/%d", i+1, expected)
		}
	}
}

func requireErrorCode(t *testing.T, c *Client, code string) {
	t.Helper()
	env := waitForMessageType(c, EventTypeError, time.Second)
	if env == nil {
		t.Fatalf("expected error envelope with code %q", code)
	}
	var payload ErrorPayload
	if err := json.Unmarshal(env.Payload, &payload); err != nil {
		t.Fatalf("unmarshal error payload: %v", err)
	}
	if payload.Code != code {
		t.Fatalf("expected error code %q, got %q", code, payload.Code)
	}
}

func TestBoothInvite_RelaysToOnlineUser(t *testing.T) {
	hub := NewHub()
	inviter := newTestClient(hub, uuid.New())
	invitee := newTestClient(hub, uuid.New())
	hub.registerClient(inviter)
	hub.registerClient(invitee)
	drainChannel(inviter)
	drainChannel(invitee)

	payload, _ := json.Marshal(BoothInvitePayload{
		BoothID:   "booth-a",
		InviterID: inviter.UserID.String(),
		InviteeID: invitee.UserID.String(),
	})
	inviter.handleBoothInvite(payload)
	processUserBroadcasts(t, hub, 1)

	env := waitForMessageType(invitee, EventTypeBoothInvite, time.Second)
	if env == nil {
		t.Fatal("expected booth_invite for invitee")
	}
}

func TestBoothInvite_RejectsZeroInviteeID(t *testing.T) {
	hub := NewHub()
	inviter := newTestClient(hub, uuid.New())
	hub.registerClient(inviter)
	drainChannel(inviter)

	payload, _ := json.Marshal(BoothInvitePayload{
		BoothID:   "booth-a",
		InviterID: inviter.UserID.String(),
		InviteeID: uuid.Nil.String(),
	})
	inviter.handleBoothInvite(payload)

	requireErrorCode(t, inviter, "invalid_payload")
	select {
	case <-hub.userBroadcast:
		t.Fatal("did not expect user relay for invalid invite payload")
	default:
	}
}

func TestBoothInviteResponse_RelaysToInviter(t *testing.T) {
	hub := NewHub()
	inviter := newTestClient(hub, uuid.New())
	invitee := newTestClient(hub, uuid.New())
	hub.registerClient(inviter)
	hub.registerClient(invitee)
	drainChannel(inviter)
	drainChannel(invitee)

	payload, _ := json.Marshal(BoothInviteResponsePayload{
		BoothID:   "booth-b",
		InviterID: inviter.UserID.String(),
		InviteeID: invitee.UserID.String(),
		Accepted:  true,
	})
	invitee.handleBoothInviteResponse(payload)
	processUserBroadcasts(t, hub, 1)

	env := waitForMessageType(inviter, EventTypeBoothInviteResponse, time.Second)
	if env == nil {
		t.Fatal("expected booth_invite_response for inviter")
	}

	participants := hub.GetBoothParticipants("booth-b")
	if len(participants) != 2 {
		t.Fatalf("expected inviter+invitee to be tracked, got %d participants", len(participants))
	}
}

func TestBoothInviteResponse_RejectsWrongResponder(t *testing.T) {
	hub := NewHub()
	inviter := newTestClient(hub, uuid.New())
	wrongResponder := newTestClient(hub, uuid.New())
	actualInvitee := uuid.New()
	hub.registerClient(inviter)
	hub.registerClient(wrongResponder)
	drainChannel(inviter)
	drainChannel(wrongResponder)

	payload, _ := json.Marshal(BoothInviteResponsePayload{
		BoothID:   "booth-c",
		InviterID: inviter.UserID.String(),
		InviteeID: actualInvitee.String(),
		Accepted:  true,
	})
	wrongResponder.handleBoothInviteResponse(payload)

	requireErrorCode(t, wrongResponder, "forbidden")
	select {
	case <-hub.userBroadcast:
		t.Fatal("did not expect relay when responder does not match invitee")
	default:
	}
}

func TestBoothPrivacyUpdate_RequiresHost(t *testing.T) {
	hub := NewHub()
	nonHost := newTestClient(hub, uuid.New())
	hostID := uuid.New()
	hub.registerClient(nonHost)
	drainChannel(nonHost)

	payload, _ := json.Marshal(map[string]any{
		"booth_id":                "booth-d",
		"host_id":                 hostID.String(),
		"invite_only":             true,
		"room_locked":             false,
		"companion_voice_allowed": true,
		"max_guest_count":         2,
	})
	nonHost.handleBoothPrivacyUpdate(payload)

	requireErrorCode(t, nonHost, "forbidden")
	select {
	case <-hub.userBroadcast:
		t.Fatal("did not expect broadcast from non-host privacy update")
	default:
	}
}

func TestBoothPrivacyUpdate_BroadcastsToParticipants(t *testing.T) {
	hub := NewHub()
	host := newTestClient(hub, uuid.New())
	p2 := newTestClient(hub, uuid.New())
	p3 := newTestClient(hub, uuid.New())
	hub.registerClient(host)
	hub.registerClient(p2)
	hub.registerClient(p3)
	drainChannel(host)
	drainChannel(p2)
	drainChannel(p3)

	boothID := "booth-e"
	hub.AddBoothParticipant(boothID, host.UserID)
	hub.AddBoothParticipant(boothID, p2.UserID)
	hub.AddBoothParticipant(boothID, p3.UserID)

	payload, _ := json.Marshal(map[string]any{
		"booth_id":                boothID,
		"host_id":                 host.UserID.String(),
		"invite_only":             true,
		"room_locked":             true,
		"companion_voice_allowed": false,
		"max_guest_count":         1,
	})
	host.handleBoothPrivacyUpdate(payload)
	processUserBroadcasts(t, hub, 3)

	if waitForMessageType(host, EventTypeBoothPrivacyUpdate, time.Second) == nil {
		t.Fatal("expected host to receive privacy update")
	}
	if waitForMessageType(p2, EventTypeBoothPrivacyUpdate, time.Second) == nil {
		t.Fatal("expected participant p2 to receive privacy update")
	}
	if waitForMessageType(p3, EventTypeBoothPrivacyUpdate, time.Second) == nil {
		t.Fatal("expected participant p3 to receive privacy update")
	}
}

func TestBoothHostControl_ValidatesAction(t *testing.T) {
	hub := NewHub()
	host := newTestClient(hub, uuid.New())
	hub.registerClient(host)
	drainChannel(host)

	payload, _ := json.Marshal(BoothHostControlPayload{
		BoothID: "booth-f",
		HostID:  host.UserID.String(),
		Action:  "not_valid",
	})
	host.handleBoothHostControl(payload)

	requireErrorCode(t, host, "invalid_payload")
	select {
	case <-hub.userBroadcast:
		t.Fatal("did not expect broadcast for invalid host control action")
	default:
	}
}

func TestBoothHostControl_EndParty_SendsDisconnect(t *testing.T) {
	hub := NewHub()
	host := newTestClient(hub, uuid.New())
	p2 := newTestClient(hub, uuid.New())
	p3 := newTestClient(hub, uuid.New())
	hub.registerClient(host)
	hub.registerClient(p2)
	hub.registerClient(p3)
	drainChannel(host)
	drainChannel(p2)
	drainChannel(p3)

	boothID := "booth-g"
	hub.AddBoothParticipant(boothID, host.UserID)
	hub.AddBoothParticipant(boothID, p2.UserID)
	hub.AddBoothParticipant(boothID, p3.UserID)

	payload, _ := json.Marshal(BoothHostControlPayload{
		BoothID: boothID,
		HostID:  host.UserID.String(),
		Action:  "end_party",
	})
	host.handleBoothHostControl(payload)
	processUserBroadcasts(t, hub, 6)

	clients := []*Client{host, p2, p3}
	for _, c := range clients {
		if waitForMessageType(c, EventTypeBoothHostControl, time.Second) == nil {
			t.Fatalf("expected booth_host_control for user %s", c.UserID)
		}
		if waitForMessageType(c, EventTypeSessionEnded, time.Second) == nil {
			t.Fatalf("expected session_ended disconnect signal for user %s", c.UserID)
		}
	}

	if len(hub.GetBoothParticipants(boothID)) != 0 {
		t.Fatal("expected booth participants to be cleared after end_party")
	}
}
