// Package metrics provides Prometheus instrumentation for the Drift API.
package metrics

import (
	"bufio"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	// HTTP metrics
	httpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests by method, path, and status code",
		},
		[]string{"method", "path", "status"},
	)

	httpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request latency in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	httpRequestsInFlight = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "http_requests_in_flight",
			Help: "Current number of HTTP requests being processed",
		},
	)

	// WebSocket metrics
	WebsocketConnectionsActive = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "websocket_connections_active",
			Help: "Current number of active WebSocket connections",
		},
	)

	WebsocketMessagesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "websocket_messages_total",
			Help: "Total number of WebSocket messages by direction and type",
		},
		[]string{"direction", "type"},
	)

	// Database metrics
	DBConnectionsActive = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "db_connections_active",
			Help: "Current number of active database connections",
		},
	)

	DBQueryDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "db_query_duration_seconds",
			Help:    "Database query latency in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"operation"},
	)

	// Business metrics
	ActiveUsers = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "drift_active_users",
			Help: "Number of users currently online",
		},
	)

	MatchesTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "drift_matches_total",
			Help: "Total number of matches created",
		},
	)

	MessagesTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "drift_messages_total",
			Help: "Total number of chat messages sent",
		},
	)
)

// Handler returns the Prometheus metrics HTTP handler
func Handler() http.Handler {
	return promhttp.Handler()
}

// Middleware returns a chi middleware that records HTTP metrics
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		httpRequestsInFlight.Inc()
		defer httpRequestsInFlight.Dec()

		// Wrap response writer to capture status code
		ww := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(ww, r)

		duration := time.Since(start).Seconds()

		// Get route pattern if available (chi)
		routePattern := chi.RouteContext(r.Context()).RoutePattern()
		if routePattern == "" {
			routePattern = r.URL.Path
		}

		httpRequestsTotal.WithLabelValues(
			r.Method,
			routePattern,
			strconv.Itoa(ww.statusCode),
		).Inc()

		httpRequestDuration.WithLabelValues(
			r.Method,
			routePattern,
		).Observe(duration)
	})
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Hijack delegates hijacking to the underlying writer when supported.
func (rw *responseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := rw.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("response writer does not support hijacking")
	}
	return hijacker.Hijack()
}

// RecordWebSocketConnect increments the active WebSocket connection count
func RecordWebSocketConnect() {
	WebsocketConnectionsActive.Inc()
}

// RecordWebSocketDisconnect decrements the active WebSocket connection count
func RecordWebSocketDisconnect() {
	WebsocketConnectionsActive.Dec()
}

// RecordWebSocketMessage records a WebSocket message
func RecordWebSocketMessage(direction, msgType string) {
	WebsocketMessagesTotal.WithLabelValues(direction, msgType).Inc()
}

// RecordMatch increments the match counter
func RecordMatch() {
	MatchesTotal.Inc()
}

// RecordMessage increments the message counter
func RecordMessage() {
	MessagesTotal.Inc()
}

// SetActiveUsers sets the current number of active users
func SetActiveUsers(count float64) {
	ActiveUsers.Set(count)
}

// SetDBConnections sets the current number of active database connections
func SetDBConnections(count float64) {
	DBConnectionsActive.Set(count)
}
