package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisRateLimiter implements per-IP rate limiting backed by Redis.
// This works across multiple server instances.
type RedisRateLimiter struct {
	client *redis.Client
	rate   int
	window time.Duration
	prefix string
}

// NewRedisRateLimiter creates a rate limiter that uses Redis for distributed state.
func NewRedisRateLimiter(client *redis.Client, rate int, window time.Duration) *RedisRateLimiter {
	return &RedisRateLimiter{
		client: client,
		rate:   rate,
		window: window,
		prefix: "rl:",
	}
}

// Limit returns middleware that enforces the rate limit via Redis.
func (rl *RedisRateLimiter) Limit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
			ip = forwarded
		}

		allowed, err := rl.allow(r.Context(), ip)
		if err != nil {
			// On Redis error, allow the request (fail open)
			next.ServeHTTP(w, r)
			return
		}

		if !allowed {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error":"rate limit exceeded"}`))
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (rl *RedisRateLimiter) allow(ctx context.Context, ip string) (bool, error) {
	key := fmt.Sprintf("%s%s", rl.prefix, ip)

	// Use a Lua script for atomic increment + expiry
	script := redis.NewScript(`
		local current = redis.call("INCR", KEYS[1])
		if current == 1 then
			redis.call("PEXPIRE", KEYS[1], ARGV[1])
		end
		return current
	`)

	windowMs := int64(rl.window / time.Millisecond)
	result, err := script.Run(ctx, rl.client, []string{key}, windowMs).Int64()
	if err != nil {
		return false, err
	}

	return result <= int64(rl.rate), nil
}
