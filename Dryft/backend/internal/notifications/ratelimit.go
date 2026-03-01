package notifications

import (
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"

	"github.com/google/uuid"
)

// RateLimitConfig defines rate limits per notification type
type RateLimitConfig struct {
	// Max notifications per window
	MaxPerWindow int
	// Window duration
	Window time.Duration
	// Deduplication window (same content won't be sent twice within this window)
	DedupeWindow time.Duration
}

// DefaultRateLimits returns sensible defaults for each notification type
var DefaultRateLimits = map[NotificationType]RateLimitConfig{
	NotificationTypeNewMatch: {
		MaxPerWindow: 10,           // Max 10 match notifications per hour
		Window:       time.Hour,
		DedupeWindow: time.Hour,    // Don't duplicate match notifications for 1 hour
	},
	NotificationTypeNewMessage: {
		MaxPerWindow: 30,           // Max 30 message notifications per 5 minutes
		Window:       5 * time.Minute,
		DedupeWindow: 30 * time.Second, // Group rapid messages
	},
	NotificationTypeNewLike: {
		MaxPerWindow: 5,            // Max 5 like notifications per hour (privacy + anti-spam)
		Window:       time.Hour,
		DedupeWindow: time.Hour,    // Don't spam with likes
	},
	NotificationTypeSystem: {
		MaxPerWindow: 20,           // Max 20 system notifications per hour
		Window:       time.Hour,
		DedupeWindow: 5 * time.Minute,
	},
}

// rateLimitEntry tracks notifications for a user+type combination
type rateLimitEntry struct {
	timestamps []time.Time
	lastHash   string
	lastSent   time.Time
}

// RateLimiter implements in-memory rate limiting for notifications
type RateLimiter struct {
	mu      sync.RWMutex
	entries map[string]*rateLimitEntry // key: userID:notificationType
	limits  map[NotificationType]RateLimitConfig

	// Cleanup ticker
	stopCleanup chan struct{}
}

// NewRateLimiter creates a new rate limiter with default limits
func NewRateLimiter() *RateLimiter {
	rl := &RateLimiter{
		entries:     make(map[string]*rateLimitEntry),
		limits:      DefaultRateLimits,
		stopCleanup: make(chan struct{}),
	}

	// Start background cleanup goroutine
	go rl.cleanupLoop()

	return rl
}

// NewRateLimiterWithConfig creates a rate limiter with custom limits
func NewRateLimiterWithConfig(limits map[NotificationType]RateLimitConfig) *RateLimiter {
	rl := &RateLimiter{
		entries:     make(map[string]*rateLimitEntry),
		limits:      limits,
		stopCleanup: make(chan struct{}),
	}

	go rl.cleanupLoop()

	return rl
}

// Stop stops the rate limiter's background cleanup
func (rl *RateLimiter) Stop() {
	close(rl.stopCleanup)
}

// cleanupLoop periodically removes expired entries
func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			rl.cleanup()
		case <-rl.stopCleanup:
			return
		}
	}
}

// cleanup removes expired entries
func (rl *RateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	maxWindow := time.Hour * 2 // Keep entries for at most 2 hours

	for key, entry := range rl.entries {
		// Remove entries that haven't been used recently
		if now.Sub(entry.lastSent) > maxWindow {
			delete(rl.entries, key)
		}
	}
}

// RateLimitResult contains the result of a rate limit check
type RateLimitResult struct {
	Allowed     bool
	Reason      string
	RetryAfter  time.Duration
	IsDuplicate bool
}

// Check checks if a notification can be sent
func (rl *RateLimiter) Check(userID uuid.UUID, notification *Notification) RateLimitResult {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	key := userID.String() + ":" + string(notification.Type)
	now := time.Now()

	// Get or create entry
	entry, exists := rl.entries[key]
	if !exists {
		entry = &rateLimitEntry{
			timestamps: make([]time.Time, 0),
		}
		rl.entries[key] = entry
	}

	// Get limits for this notification type
	limits, ok := rl.limits[notification.Type]
	if !ok {
		// No limits configured, allow
		return RateLimitResult{Allowed: true}
	}

	// Check for duplicate content
	contentHash := rl.hashNotification(notification)
	if entry.lastHash == contentHash && now.Sub(entry.lastSent) < limits.DedupeWindow {
		return RateLimitResult{
			Allowed:     false,
			Reason:      "duplicate notification",
			RetryAfter:  limits.DedupeWindow - now.Sub(entry.lastSent),
			IsDuplicate: true,
		}
	}

	// Clean up old timestamps outside the window
	windowStart := now.Add(-limits.Window)
	validTimestamps := make([]time.Time, 0, len(entry.timestamps))
	for _, ts := range entry.timestamps {
		if ts.After(windowStart) {
			validTimestamps = append(validTimestamps, ts)
		}
	}
	entry.timestamps = validTimestamps

	// Check rate limit
	if len(entry.timestamps) >= limits.MaxPerWindow {
		// Find when the oldest timestamp will expire
		oldestInWindow := entry.timestamps[0]
		retryAfter := limits.Window - now.Sub(oldestInWindow)

		return RateLimitResult{
			Allowed:    false,
			Reason:     "rate limit exceeded",
			RetryAfter: retryAfter,
		}
	}

	// Allow the notification
	return RateLimitResult{Allowed: true}
}

// Record records that a notification was sent
func (rl *RateLimiter) Record(userID uuid.UUID, notification *Notification) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	key := userID.String() + ":" + string(notification.Type)
	now := time.Now()

	entry, exists := rl.entries[key]
	if !exists {
		entry = &rateLimitEntry{
			timestamps: make([]time.Time, 0),
		}
		rl.entries[key] = entry
	}

	entry.timestamps = append(entry.timestamps, now)
	entry.lastHash = rl.hashNotification(notification)
	entry.lastSent = now
}

// hashNotification creates a hash of the notification content for deduplication
func (rl *RateLimiter) hashNotification(notification *Notification) string {
	// Hash title + body + key data fields
	content := notification.Title + "|" + notification.Body

	// Include relevant data fields in hash
	if notification.Data != nil {
		if matchID, ok := notification.Data["match_id"]; ok {
			content += "|" + matchID
		}
		if callID, ok := notification.Data["call_id"]; ok {
			content += "|" + callID
		}
	}

	hash := sha256.Sum256([]byte(content))
	return hex.EncodeToString(hash[:8]) // Use first 8 bytes for shorter hash
}

// GetStats returns rate limiting statistics for a user
func (rl *RateLimiter) GetStats(userID uuid.UUID, notifType NotificationType) (sent int, remaining int, resetIn time.Duration) {
	rl.mu.RLock()
	defer rl.mu.RUnlock()

	key := userID.String() + ":" + string(notifType)
	limits, ok := rl.limits[notifType]
	if !ok {
		return 0, -1, 0 // No limits
	}

	entry, exists := rl.entries[key]
	if !exists {
		return 0, limits.MaxPerWindow, 0
	}

	now := time.Now()
	windowStart := now.Add(-limits.Window)

	// Count valid timestamps
	count := 0
	var oldestInWindow time.Time
	for _, ts := range entry.timestamps {
		if ts.After(windowStart) {
			count++
			if oldestInWindow.IsZero() || ts.Before(oldestInWindow) {
				oldestInWindow = ts
			}
		}
	}

	remaining = limits.MaxPerWindow - count
	if remaining < 0 {
		remaining = 0
	}

	if !oldestInWindow.IsZero() {
		resetIn = limits.Window - now.Sub(oldestInWindow)
		if resetIn < 0 {
			resetIn = 0
		}
	}

	return count, remaining, resetIn
}
