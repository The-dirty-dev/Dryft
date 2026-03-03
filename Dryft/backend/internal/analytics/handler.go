package analytics

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/dryft-app/backend/internal/httputil"
)

// Handler handles HTTP requests for analytics
type Handler struct {
	service analyticsHandlerService
}

type analyticsHandlerService interface {
	IngestBatch(batch EventBatch) error
	GetUserAnalytics(userID string) (*UserAnalytics, error)
	GetDailyMetrics(startDate, endDate time.Time) ([]DailyMetrics, error)
	GetEventCounts(startDate, endDate time.Time, eventName string) ([]EventMetrics, error)
	GetTopEvents(days int, limit int) ([]struct {
		Name  string
		Count int
	}, error)
	GetRecentEvents(userID string, limit int) ([]Event, error)
}

// NewHandler creates a new analytics handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers analytics routes
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/analytics", func(r chi.Router) {
		// Event ingestion
		r.Post("/events", h.IngestEvents)

		// Query endpoints (admin only)
		r.Get("/user/{userId}", h.GetUserAnalytics)
		r.Get("/metrics/daily", h.GetDailyMetrics)
		r.Get("/metrics/events", h.GetEventCounts)
		r.Get("/metrics/top-events", h.GetTopEvents)
		r.Get("/events/recent/{userId}", h.GetRecentEvents)

		// Dashboard summary
		r.Get("/dashboard", h.GetDashboardSummary)
	})
}

// IngestEvents handles event batch ingestion
func (h *Handler) IngestEvents(w http.ResponseWriter, r *http.Request) {
	var batch EventBatch
	if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.service.IngestBatch(batch); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusAccepted, map[string]any{
		"status": "accepted",
		"count":  len(batch.Events),
	})
}

// GetUserAnalytics returns analytics for a specific user
func (h *Handler) GetUserAnalytics(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")
	if userID == "" {
		httputil.RespondError(w, http.StatusBadRequest, "user ID required")
		return
	}

	analytics, err := h.service.GetUserAnalytics(userID)
	if err != nil {
		httputil.RespondError(w, http.StatusNotFound, err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, analytics)
}

// GetDailyMetrics returns daily metrics for a date range
func (h *Handler) GetDailyMetrics(w http.ResponseWriter, r *http.Request) {
	startStr := r.URL.Query().Get("start")
	endStr := r.URL.Query().Get("end")

	start, err := time.Parse("2006-01-02", startStr)
	if err != nil {
		start = time.Now().AddDate(0, 0, -30)
	}

	end, err := time.Parse("2006-01-02", endStr)
	if err != nil {
		end = time.Now()
	}

	metrics, err := h.service.GetDailyMetrics(start, end)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{
		"metrics": metrics,
		"start":   start.Format("2006-01-02"),
		"end":     end.Format("2006-01-02"),
	})
}

// GetEventCounts returns event counts
func (h *Handler) GetEventCounts(w http.ResponseWriter, r *http.Request) {
	startStr := r.URL.Query().Get("start")
	endStr := r.URL.Query().Get("end")
	eventName := r.URL.Query().Get("event")

	start, _ := time.Parse("2006-01-02", startStr)
	if start.IsZero() {
		start = time.Now().AddDate(0, 0, -30)
	}

	end, _ := time.Parse("2006-01-02", endStr)
	if end.IsZero() {
		end = time.Now()
	}

	metrics, err := h.service.GetEventCounts(start, end, eventName)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, metrics)
}

// GetTopEvents returns most common events
func (h *Handler) GetTopEvents(w http.ResponseWriter, r *http.Request) {
	daysStr := r.URL.Query().Get("days")
	limitStr := r.URL.Query().Get("limit")

	days, _ := strconv.Atoi(daysStr)
	if days == 0 {
		days = 7
	}

	limit, _ := strconv.Atoi(limitStr)
	if limit == 0 {
		limit = 20
	}

	events, err := h.service.GetTopEvents(days, limit)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{
		"events": events,
		"days":   days,
	})
}

// GetRecentEvents returns recent events for a user
func (h *Handler) GetRecentEvents(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")
	limitStr := r.URL.Query().Get("limit")

	limit, _ := strconv.Atoi(limitStr)
	if limit == 0 {
		limit = 50
	}

	events, err := h.service.GetRecentEvents(userID, limit)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, events)
}

// DashboardSummary represents the admin dashboard summary
type DashboardSummary struct {
	Today      DayStats       `json:"today"`
	Yesterday  DayStats       `json:"yesterday"`
	Week       WeekStats      `json:"week"`
	TopEvents  []EventCount   `json:"topEvents"`
	RecentDays []DailyMetrics `json:"recentDays"`
}

type DayStats struct {
	ActiveUsers int     `json:"activeUsers"`
	NewUsers    int     `json:"newUsers"`
	Sessions    int     `json:"sessions"`
	Matches     int     `json:"matches"`
	Messages    int     `json:"messages"`
	VRSessions  int     `json:"vrSessions"`
	Revenue     float64 `json:"revenue"`
}

type WeekStats struct {
	TotalUsers     int     `json:"totalUsers"`
	TotalSessions  int     `json:"totalSessions"`
	TotalMatches   int     `json:"totalMatches"`
	TotalMessages  int     `json:"totalMessages"`
	TotalRevenue   float64 `json:"totalRevenue"`
	AvgSessionsDay float64 `json:"avgSessionsPerDay"`
}

type EventCount struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// GetDashboardSummary returns a summary for the admin dashboard
func (h *Handler) GetDashboardSummary(w http.ResponseWriter, r *http.Request) {
	now := time.Now()
	today := now.Truncate(24 * time.Hour)
	yesterday := today.AddDate(0, 0, -1)
	weekAgo := today.AddDate(0, 0, -7)

	// Get daily metrics for today and yesterday
	todayMetrics, _ := h.service.GetDailyMetrics(today, today)
	yesterdayMetrics, _ := h.service.GetDailyMetrics(yesterday, yesterday)
	weekMetrics, _ := h.service.GetDailyMetrics(weekAgo, today)

	summary := DashboardSummary{}

	// Today stats
	if len(todayMetrics) > 0 {
		m := todayMetrics[0]
		summary.Today = DayStats{
			ActiveUsers: m.ActiveUsers,
			NewUsers:    m.NewUsers,
			Sessions:    m.Sessions,
			Matches:     m.Matches,
			Messages:    m.Messages,
			VRSessions:  m.VRSessions,
			Revenue:     m.Revenue,
		}
	}

	// Yesterday stats
	if len(yesterdayMetrics) > 0 {
		m := yesterdayMetrics[0]
		summary.Yesterday = DayStats{
			ActiveUsers: m.ActiveUsers,
			NewUsers:    m.NewUsers,
			Sessions:    m.Sessions,
			Matches:     m.Matches,
			Messages:    m.Messages,
			VRSessions:  m.VRSessions,
			Revenue:     m.Revenue,
		}
	}

	// Week stats
	for _, m := range weekMetrics {
		summary.Week.TotalUsers += m.ActiveUsers
		summary.Week.TotalSessions += m.Sessions
		summary.Week.TotalMatches += m.Matches
		summary.Week.TotalMessages += m.Messages
		summary.Week.TotalRevenue += m.Revenue
	}
	if len(weekMetrics) > 0 {
		summary.Week.AvgSessionsDay = float64(summary.Week.TotalSessions) / float64(len(weekMetrics))
	}

	// Top events
	topEvents, _ := h.service.GetTopEvents(7, 10)
	for _, e := range topEvents {
		summary.TopEvents = append(summary.TopEvents, EventCount{
			Name:  e.Name,
			Count: e.Count,
		})
	}

	// Recent days
	summary.RecentDays = weekMetrics

	httputil.RespondJSON(w, http.StatusOK, summary)
}
