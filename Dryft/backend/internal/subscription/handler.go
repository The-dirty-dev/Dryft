package subscription

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/subscriptions", func(r chi.Router) {
		r.Get("/status", h.GetStatus)
		r.Get("/entitlements", h.GetEntitlements)
		r.Post("/verify", h.VerifyPurchase)
		r.Post("/restore", h.RestorePurchases)
		r.Post("/cancel", h.CancelSubscription)

		// Consumables
		r.Post("/use-boost", h.UseBoost)
		r.Post("/use-super-like", h.UseSuperLike)
		r.Post("/use-like", h.UseLike)

		// Check specific entitlements
		r.Get("/has/{entitlement}", h.HasEntitlement)
	})
}

type StatusResponse struct {
	Subscription        *SubscriptionInfo `json:"subscription,omitempty"`
	Tier                string            `json:"tier"`
	BoostsRemaining     int               `json:"boosts_remaining"`
	SuperLikesRemaining int               `json:"super_likes_remaining"`
	DailyLikesRemaining int               `json:"daily_likes_remaining"`
	Entitlements        Entitlements      `json:"entitlements"`
}

type SubscriptionInfo struct {
	Tier         string `json:"tier"`
	ProductID    string `json:"product_id"`
	ExpiresAt    string `json:"expires_at"`
	WillRenew    bool   `json:"will_renew"`
	PurchaseDate string `json:"purchase_date"`
	Platform     string `json:"platform"`
}

func (h *Handler) GetStatus(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	sub, err := h.service.GetSubscription(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	credits, _ := h.service.GetUserCredits(r.Context(), userID)
	entitlements, _ := h.service.GetEntitlements(r.Context(), userID)
	tier, _ := h.service.GetUserTier(r.Context(), userID)

	response := StatusResponse{
		Tier:         string(tier),
		Entitlements: entitlements,
	}

	if sub != nil {
		response.Subscription = &SubscriptionInfo{
			Tier:         string(sub.Tier),
			ProductID:    sub.ProductID,
			ExpiresAt:    sub.ExpiresAt.Format("2006-01-02T15:04:05Z"),
			WillRenew:    sub.WillRenew,
			PurchaseDate: sub.PurchaseDate.Format("2006-01-02T15:04:05Z"),
			Platform:     string(sub.Platform),
		}
	}

	if credits != nil {
		response.BoostsRemaining = credits.Boosts
		response.SuperLikesRemaining = credits.SuperLikes

		if entitlements.DailyLikes == -1 {
			response.DailyLikesRemaining = -1
		} else {
			response.DailyLikesRemaining = entitlements.DailyLikes - credits.DailyLikesUsed
		}

		if entitlements.DailySuperLikes == -1 {
			response.SuperLikesRemaining = -1
		} else {
			dailyRemaining := entitlements.DailySuperLikes - credits.DailySuperLikesUsed
			response.SuperLikesRemaining = credits.SuperLikes + dailyRemaining
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) GetEntitlements(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	entitlements, err := h.service.GetEntitlements(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entitlements)
}

type VerifyRequest struct {
	ProductID string `json:"product_id"`
	Receipt   string `json:"receipt"`
	Platform  string `json:"platform"`
}

func (h *Handler) VerifyPurchase(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	var req VerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	platform := Platform(req.Platform)
	if platform != PlatformIOS && platform != PlatformAndroid {
		http.Error(w, "Invalid platform", http.StatusBadRequest)
		return
	}

	sub, err := h.service.VerifyAndCreateSubscription(r.Context(), userID, req.ProductID, req.Receipt, platform)
	if err != nil {
		status := http.StatusInternalServerError
		if err == ErrInvalidReceipt {
			status = http.StatusBadRequest
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"tier":         sub.Tier,
		"expires_at":   sub.ExpiresAt.Format("2006-01-02T15:04:05Z"),
		"entitlements": TierEntitlements[sub.Tier],
	})
}

type RestoreRequest struct {
	Purchases []struct {
		ProductID string `json:"product_id"`
		Receipt   string `json:"receipt"`
	} `json:"purchases"`
	Platform string `json:"platform"`
}

func (h *Handler) RestorePurchases(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	var req RestoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	platform := Platform(req.Platform)
	var lastSub *Subscription

	for _, p := range req.Purchases {
		sub, err := h.service.VerifyAndCreateSubscription(r.Context(), userID, p.ProductID, p.Receipt, platform)
		if err == nil && sub != nil {
			lastSub = sub
		}
	}

	response := map[string]interface{}{"success": true}
	if lastSub != nil {
		response["tier"] = lastSub.Tier
		response["expires_at"] = lastSub.ExpiresAt.Format("2006-01-02T15:04:05Z")
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) CancelSubscription(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	if err := h.service.CancelSubscription(r.Context(), userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (h *Handler) UseBoost(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	remaining, err := h.service.UseBoost(r.Context(), userID)
	if err != nil {
		status := http.StatusInternalServerError
		if err == ErrInsufficientCredits {
			status = http.StatusPaymentRequired
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":          true,
		"boosts_remaining": remaining,
	})
}

func (h *Handler) UseSuperLike(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	remaining, err := h.service.UseSuperLike(r.Context(), userID)
	if err != nil {
		status := http.StatusInternalServerError
		if err == ErrInsufficientCredits {
			status = http.StatusPaymentRequired
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":              true,
		"super_likes_remaining": remaining,
	})
}

func (h *Handler) UseLike(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	remaining, err := h.service.UseLike(r.Context(), userID)
	if err != nil {
		status := http.StatusInternalServerError
		if err == ErrInsufficientCredits {
			status = http.StatusPaymentRequired
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":         true,
		"likes_remaining": remaining,
	})
}

func (h *Handler) HasEntitlement(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	entitlement := chi.URLParam(r, "entitlement")

	has, err := h.service.HasEntitlement(r.Context(), userID, entitlement)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"entitlement": entitlement,
		"has_access":  has,
	})
}
