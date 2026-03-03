package marketplace

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/webhook"

	"github.com/dryft-app/backend/internal/httputil"
)

// PurchaseItemRequest represents a purchase request
type PurchaseItemRequest struct {
	ItemID string `json:"item_id"`
}

// InitiatePurchase handles POST /v1/store/purchase
func (h *Handler) InitiatePurchase(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	var req PurchaseItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	itemID, err := uuid.Parse(req.ItemID)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid item_id")
		return
	}

	result, err := h.purchase.InitiatePurchase(r.Context(), *userID, itemID)
	if err != nil {
		switch {
		case errors.Is(err, ErrAlreadyOwned):
			httputil.WriteError(w, http.StatusConflict, "you already own this item")
		case errors.Is(err, ErrItemNotFound):
			httputil.WriteError(w, http.StatusNotFound, "item not found")
		case errors.Is(err, ErrItemUnavailable):
			httputil.WriteError(w, http.StatusBadRequest, "item is not available for purchase")
		default:
			httputil.WriteError(w, http.StatusInternalServerError, "failed to initiate purchase")
		}
		return
	}

	httputil.WriteJSON(w, http.StatusOK, result)
}

const maxBodyBytes = int64(65536)

// HandleStripeWebhook handles POST /v1/webhooks/stripe/marketplace
func (h *Handler) HandleStripeWebhook(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	payload, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("[Webhook] Error reading body: %v", err)
		httputil.WriteError(w, http.StatusServiceUnavailable, "error reading request body")
		return
	}

	// Verify webhook signature
	sigHeader := r.Header.Get("Stripe-Signature")
	event, err := webhook.ConstructEvent(payload, sigHeader, h.cfg.StripeWebhookSecret)
	if err != nil {
		log.Printf("[Webhook] Signature verification failed: %v", err)
		httputil.WriteError(w, http.StatusBadRequest, "invalid webhook signature")
		return
	}

	log.Printf("[Webhook] Received event: %s", event.Type)

	switch event.Type {
	case "payment_intent.succeeded":
		var pi stripe.PaymentIntent
		if err := json.Unmarshal(event.Data.Raw, &pi); err != nil {
			log.Printf("[Webhook] Error parsing payment_intent: %v", err)
			httputil.WriteError(w, http.StatusBadRequest, "error parsing event data")
			return
		}

		if err := h.purchase.CompletePurchase(r.Context(), pi.ID); err != nil {
			log.Printf("[Webhook] Error completing purchase for %s: %v", pi.ID, err)
			// Still return 200 to acknowledge receipt - we'll retry manually if needed
		} else {
			log.Printf("[Webhook] Completed purchase for payment_intent: %s", pi.ID)
		}

	case "payment_intent.payment_failed":
		var pi stripe.PaymentIntent
		if err := json.Unmarshal(event.Data.Raw, &pi); err != nil {
			log.Printf("[Webhook] Error parsing payment_intent: %v", err)
			httputil.WriteError(w, http.StatusBadRequest, "error parsing event data")
			return
		}

		if err := h.purchase.FailPurchase(r.Context(), pi.ID); err != nil {
			log.Printf("[Webhook] Error failing purchase for %s: %v", pi.ID, err)
		} else {
			log.Printf("[Webhook] Marked purchase as failed for payment_intent: %s", pi.ID)
		}

	case "payment_intent.canceled":
		var pi stripe.PaymentIntent
		if err := json.Unmarshal(event.Data.Raw, &pi); err != nil {
			log.Printf("[Webhook] Error parsing payment_intent: %v", err)
			httputil.WriteError(w, http.StatusBadRequest, "error parsing event data")
			return
		}

		if err := h.purchase.FailPurchase(r.Context(), pi.ID); err != nil {
			log.Printf("[Webhook] Error canceling purchase for %s: %v", pi.ID, err)
		} else {
			log.Printf("[Webhook] Marked purchase as canceled for payment_intent: %s", pi.ID)
		}

	default:
		log.Printf("[Webhook] Unhandled event type: %s", event.Type)
	}

	w.WriteHeader(http.StatusOK)
}

// HandleStripeConnectWebhook handles POST /v1/webhooks/stripe/connect
func (h *Handler) HandleStripeConnectWebhook(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	payload, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("[ConnectWebhook] Error reading body: %v", err)
		httputil.WriteError(w, http.StatusServiceUnavailable, "error reading request body")
		return
	}

	// Verify webhook signature
	sigHeader := r.Header.Get("Stripe-Signature")
	event, err := webhook.ConstructEvent(payload, sigHeader, h.cfg.StripeConnectWebhookSecret)
	if err != nil {
		log.Printf("[ConnectWebhook] Signature verification failed: %v", err)
		httputil.WriteError(w, http.StatusBadRequest, "invalid webhook signature")
		return
	}

	log.Printf("[ConnectWebhook] Received event: %s", event.Type)

	switch event.Type {
	case "account.updated":
		var account stripe.Account
		if err := json.Unmarshal(event.Data.Raw, &account); err != nil {
			log.Printf("[ConnectWebhook] Error parsing account: %v", err)
			httputil.WriteError(w, http.StatusBadRequest, "error parsing event data")
			return
		}

		// Check if account is fully onboarded
		chargesEnabled := account.ChargesEnabled
		payoutsEnabled := account.PayoutsEnabled

		if chargesEnabled && payoutsEnabled {
			if err := h.creator.UpdateOnboardingStatus(r.Context(), account.ID, true); err != nil {
				log.Printf("[ConnectWebhook] Error updating onboarding status for %s: %v", account.ID, err)
			} else {
				log.Printf("[ConnectWebhook] Creator %s onboarding complete", account.ID)
			}
		} else {
			log.Printf("[ConnectWebhook] Account %s: charges=%v, payouts=%v", account.ID, chargesEnabled, payoutsEnabled)
		}

	case "account.application.deauthorized":
		var account stripe.Account
		if err := json.Unmarshal(event.Data.Raw, &account); err != nil {
			log.Printf("[ConnectWebhook] Error parsing account: %v", err)
			httputil.WriteError(w, http.StatusBadRequest, "error parsing event data")
			return
		}

		// Creator disconnected their Stripe account
		if err := h.creator.DisconnectStripeAccount(r.Context(), account.ID); err != nil {
			log.Printf("[ConnectWebhook] Error disconnecting account %s: %v", account.ID, err)
		} else {
			log.Printf("[ConnectWebhook] Disconnected account: %s", account.ID)
		}

	default:
		log.Printf("[ConnectWebhook] Unhandled event type: %s", event.Type)
	}

	w.WriteHeader(http.StatusOK)
}
