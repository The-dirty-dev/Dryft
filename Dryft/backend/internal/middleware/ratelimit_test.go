package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNewRateLimiter(t *testing.T) {
	rl := NewRateLimiter(10, time.Minute)
	if rl == nil {
		t.Fatal("expected non-nil RateLimiter")
	}
}

func TestRateLimiter_AllowsRequestsWithinLimit(t *testing.T) {
	rl := NewRateLimiter(5, time.Minute)
	handler := rl.Limit(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 0; i < 5; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("request %d: expected status 200, got %d", i+1, rr.Code)
		}
	}
}

func TestRateLimiter_BlocksExcessRequests(t *testing.T) {
	rl := NewRateLimiter(3, time.Minute)
	handler := rl.Limit(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	ip := "10.0.0.1:9999"

	// First 3 requests should succeed.
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = ip
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("request %d: expected status 200, got %d", i+1, rr.Code)
		}
	}

	// 4th request should be rate-limited.
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = ip
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusTooManyRequests {
		t.Errorf("expected status 429, got %d", rr.Code)
	}
}

func TestRateLimiter_ReturnsRetryAfterHeader(t *testing.T) {
	rl := NewRateLimiter(1, time.Minute)
	handler := rl.Limit(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	ip := "10.0.0.2:8080"

	// Exhaust the limit.
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = ip
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	// Next request should be blocked and include Retry-After.
	req = httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = ip
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusTooManyRequests {
		t.Fatalf("expected status 429, got %d", rr.Code)
	}
	if got := rr.Header().Get("Retry-After"); got != "60" {
		t.Errorf("expected Retry-After header %q, got %q", "60", got)
	}
	if got := rr.Header().Get("Content-Type"); got != "application/json" {
		t.Errorf("expected Content-Type %q, got %q", "application/json", got)
	}
}

func TestRateLimiter_ReturnsJSONErrorBody(t *testing.T) {
	rl := NewRateLimiter(1, time.Minute)
	handler := rl.Limit(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	ip := "10.0.0.3:7070"

	// Exhaust the limit.
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = ip
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	// Blocked request should return JSON error.
	req = httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = ip
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	expected := `{"error":"rate limit exceeded"}`
	if got := rr.Body.String(); got != expected {
		t.Errorf("expected body %q, got %q", expected, got)
	}
}

func TestRateLimiter_SeparateLimitsPerIP(t *testing.T) {
	rl := NewRateLimiter(1, time.Minute)
	handler := rl.Limit(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First IP uses its single allowed request.
	req1 := httptest.NewRequest(http.MethodGet, "/", nil)
	req1.RemoteAddr = "1.1.1.1:1111"
	rr1 := httptest.NewRecorder()
	handler.ServeHTTP(rr1, req1)

	if rr1.Code != http.StatusOK {
		t.Errorf("IP1 first request: expected 200, got %d", rr1.Code)
	}

	// Second IP should still be allowed independently.
	req2 := httptest.NewRequest(http.MethodGet, "/", nil)
	req2.RemoteAddr = "2.2.2.2:2222"
	rr2 := httptest.NewRecorder()
	handler.ServeHTTP(rr2, req2)

	if rr2.Code != http.StatusOK {
		t.Errorf("IP2 first request: expected 200, got %d", rr2.Code)
	}

	// First IP should be blocked on second request.
	req3 := httptest.NewRequest(http.MethodGet, "/", nil)
	req3.RemoteAddr = "1.1.1.1:1111"
	rr3 := httptest.NewRecorder()
	handler.ServeHTTP(rr3, req3)

	if rr3.Code != http.StatusTooManyRequests {
		t.Errorf("IP1 second request: expected 429, got %d", rr3.Code)
	}
}

func TestRateLimiter_UsesXForwardedForHeader(t *testing.T) {
	rl := NewRateLimiter(1, time.Minute)
	handler := rl.Limit(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First request with X-Forwarded-For exhausts the limit for that IP.
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "proxy:8080"
	req.Header.Set("X-Forwarded-For", "203.0.113.50")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	// Second request from same forwarded IP should be blocked.
	req = httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "proxy:8080"
	req.Header.Set("X-Forwarded-For", "203.0.113.50")
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429 for same forwarded IP, got %d", rr.Code)
	}

	// Request from a different forwarded IP should still be allowed.
	req = httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "proxy:8080"
	req.Header.Set("X-Forwarded-For", "198.51.100.10")
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 for different forwarded IP, got %d", rr.Code)
	}
}

func TestRateLimiter_WindowResetsTokens(t *testing.T) {
	// Use a very short window so we can test the reset behavior.
	rl := NewRateLimiter(1, 50*time.Millisecond)
	handler := rl.Limit(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	ip := "10.0.0.99:5555"

	// First request succeeds.
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = ip
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("first request: expected 200, got %d", rr.Code)
	}

	// Second request is blocked.
	req = httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = ip
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusTooManyRequests {
		t.Fatalf("second request: expected 429, got %d", rr.Code)
	}

	// Wait for the window to expire, then try again.
	time.Sleep(100 * time.Millisecond)

	req = httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = ip
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("after window reset: expected 200, got %d", rr.Code)
	}
}
