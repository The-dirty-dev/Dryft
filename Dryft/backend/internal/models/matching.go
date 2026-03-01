package models

import (
	"time"

	"github.com/google/uuid"
)

// SwipeDirection represents the direction of a swipe
type SwipeDirection string

const (
	SwipeLike SwipeDirection = "like"
	SwipePass SwipeDirection = "pass"
)

// Swipe represents a user's swipe action on another user
type Swipe struct {
	ID        uuid.UUID      `json:"id"`
	SwiperID  uuid.UUID      `json:"swiper_id"`  // Who swiped
	SwipedID  uuid.UUID      `json:"swiped_id"`  // Who was swiped on
	Direction SwipeDirection `json:"direction"`
	CreatedAt time.Time      `json:"created_at"`
}

// Match represents a mutual match between two users
type Match struct {
	ID        uuid.UUID  `json:"id"`
	UserAID   uuid.UUID  `json:"user_a_id"` // Lower UUID (for uniqueness)
	UserBID   uuid.UUID  `json:"user_b_id"` // Higher UUID
	MatchedAt time.Time  `json:"matched_at"`
	UnmatchedAt *time.Time `json:"unmatched_at,omitempty"` // Soft delete for unmatch
}

// MatchWithUser represents a match with the other user's profile
type MatchWithUser struct {
	Match
	OtherUser UserPublicProfile `json:"other_user"`
}

// DiscoverProfile represents a user profile in the discovery feed
type DiscoverProfile struct {
	UserPublicProfile
	Distance *float64 `json:"distance_km,omitempty"` // Distance in kilometers if available
}

// OrderedUserIDs returns user IDs in consistent order (lower first)
// This ensures (A,B) and (B,A) produce the same ordering for unique constraints
func OrderedUserIDs(a, b uuid.UUID) (uuid.UUID, uuid.UUID) {
	if a.String() < b.String() {
		return a, b
	}
	return b, a
}

// IsActive returns true if the match is still active (not unmatched)
func (m *Match) IsActive() bool {
	return m.UnmatchedAt == nil
}

// GetOtherUserID returns the ID of the other user in the match
func (m *Match) GetOtherUserID(myID uuid.UUID) uuid.UUID {
	if m.UserAID == myID {
		return m.UserBID
	}
	return m.UserAID
}
