package middleware

import (
	"net/http"
	"sync"
	"time"
)

// RateLimiter implements a simple per-IP token bucket rate limiter.
type RateLimiter struct {
	visitors map[string]*visitor
	mu       sync.Mutex
	rate     int           // requests per window
	window   time.Duration // time window
}

type visitor struct {
	tokens    int
	lastReset time.Time
}

// NewRateLimiter creates a rate limiter allowing `rate` requests per `window`.
func NewRateLimiter(rate int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		visitors: make(map[string]*visitor),
		rate:     rate,
		window:   window,
	}

	// Periodically clean up stale entries
	go rl.cleanup()

	return rl
}

// Limit returns middleware that enforces the rate limit.
func (rl *RateLimiter) Limit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
			ip = forwarded
		}

		if !rl.allow(ip) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error":"rate limit exceeded"}`))
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (rl *RateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[ip]
	if !exists || time.Since(v.lastReset) > rl.window {
		rl.visitors[ip] = &visitor{
			tokens:    rl.rate - 1,
			lastReset: time.Now(),
		}
		return true
	}

	if v.tokens <= 0 {
		return false
	}

	v.tokens--
	return true
}

func (rl *RateLimiter) cleanup() {
	for {
		time.Sleep(5 * time.Minute)
		rl.mu.Lock()
		for ip, v := range rl.visitors {
			if time.Since(v.lastReset) > rl.window*2 {
				delete(rl.visitors, ip)
			}
		}
		rl.mu.Unlock()
	}
}
