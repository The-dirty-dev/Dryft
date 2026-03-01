package notifications

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// Notifier provides convenience methods for sending common notifications
type Notifier struct {
	service *Service
}

// NewNotifier creates a new notifier
func NewNotifier(service *Service) *Notifier {
	return &Notifier{service: service}
}

// NotifyNewMatch sends a notification when two users match
func (n *Notifier) NotifyNewMatch(ctx context.Context, userID uuid.UUID, matchedUserName string, matchID uuid.UUID) error {
	notification := &Notification{
		Type:  NotificationTypeNewMatch,
		Title: "New Match! 🎉",
		Body:  fmt.Sprintf("You and %s liked each other!", matchedUserName),
		Data: map[string]string{
			"match_id": matchID.String(),
			"action":   "open_match",
		},
		Sound: "match.wav",
	}

	// Save to history
	if err := n.service.SaveNotification(ctx, userID, notification); err != nil {
		// Log but don't fail
		fmt.Printf("[Notifier] Failed to save notification: %v\n", err)
	}

	return n.service.SendToUser(ctx, userID, notification)
}

// NotifyNewMessage sends a notification for a new message
func (n *Notifier) NotifyNewMessage(ctx context.Context, userID uuid.UUID, senderName, messagePreview string, matchID uuid.UUID) error {
	// Truncate message preview
	if len(messagePreview) > 50 {
		messagePreview = messagePreview[:47] + "..."
	}

	notification := &Notification{
		Type:  NotificationTypeNewMessage,
		Title: senderName,
		Body:  messagePreview,
		Data: map[string]string{
			"match_id": matchID.String(),
			"action":   "open_chat",
		},
		Sound: "message.wav",
	}

	// Don't save message notifications to history (too many)
	return n.service.SendToUser(ctx, userID, notification)
}

// NotifyNewLike sends a notification when someone likes the user
func (n *Notifier) NotifyNewLike(ctx context.Context, userID uuid.UUID) error {
	notification := &Notification{
		Type:  NotificationTypeNewLike,
		Title: "Someone likes you! 💕",
		Body:  "Open Drift to see who it is",
		Data: map[string]string{
			"action": "open_discover",
		},
		Sound: "like.wav",
	}

	// Save to history
	if err := n.service.SaveNotification(ctx, userID, notification); err != nil {
		fmt.Printf("[Notifier] Failed to save notification: %v\n", err)
	}

	return n.service.SendToUser(ctx, userID, notification)
}

// NotifySystem sends a system notification
func (n *Notifier) NotifySystem(ctx context.Context, userID uuid.UUID, title, body string, data map[string]string) error {
	notification := &Notification{
		Type:  NotificationTypeSystem,
		Title: title,
		Body:  body,
		Data:  data,
	}

	// Save to history
	if err := n.service.SaveNotification(ctx, userID, notification); err != nil {
		fmt.Printf("[Notifier] Failed to save notification: %v\n", err)
	}

	return n.service.SendToUser(ctx, userID, notification)
}

// NotifyVerificationComplete sends a notification when age verification is complete
func (n *Notifier) NotifyVerificationComplete(ctx context.Context, userID uuid.UUID, approved bool) error {
	var title, body string
	if approved {
		title = "Verification Complete ✓"
		body = "You're now verified! Start discovering people near you."
	} else {
		title = "Verification Update"
		body = "We couldn't verify your identity. Please try again."
	}

	notification := &Notification{
		Type:  NotificationTypeSystem,
		Title: title,
		Body:  body,
		Data: map[string]string{
			"action":   "open_verification",
			"approved": fmt.Sprintf("%v", approved),
		},
	}

	if err := n.service.SaveNotification(ctx, userID, notification); err != nil {
		fmt.Printf("[Notifier] Failed to save notification: %v\n", err)
	}

	return n.service.SendToUser(ctx, userID, notification)
}

// NotifyPurchaseComplete sends a notification when a purchase is complete
func (n *Notifier) NotifyPurchaseComplete(ctx context.Context, userID uuid.UUID, itemName string, purchaseID uuid.UUID) error {
	notification := &Notification{
		Type:  NotificationTypeSystem,
		Title: "Purchase Complete 🛍️",
		Body:  fmt.Sprintf("You now own %s!", itemName),
		Data: map[string]string{
			"purchase_id": purchaseID.String(),
			"action":      "open_inventory",
		},
	}

	if err := n.service.SaveNotification(ctx, userID, notification); err != nil {
		fmt.Printf("[Notifier] Failed to save notification: %v\n", err)
	}

	return n.service.SendToUser(ctx, userID, notification)
}

// BroadcastToAll sends a notification to all users (for announcements)
func (n *Notifier) BroadcastToAll(ctx context.Context, title, body string) error {
	// This would query all active users and send to each
	// For now, this is a placeholder - in production you'd want to use FCM topics
	// or batch sending
	return nil
}
