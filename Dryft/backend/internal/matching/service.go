package matching

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/dryft-app/backend/internal/database"
	"github.com/dryft-app/backend/internal/models"
)

var (
	ErrAlreadySwiped    = errors.New("already swiped on this user")
	ErrCannotSwipeSelf  = errors.New("cannot swipe on yourself")
	ErrMatchNotFound    = errors.New("match not found")
	ErrNotInMatch       = errors.New("you are not part of this match")
	ErrAlreadyUnmatched = errors.New("already unmatched")
	ErrInvalidUserID    = errors.New("invalid user id")
	ErrInvalidMatchID   = errors.New("invalid match id")
	ErrInvalidDirection = errors.New("invalid swipe direction")
)

// MatchNotifier interface for sending match notifications
type MatchNotifier interface {
	NotifyNewMatch(ctx context.Context, userID uuid.UUID, matchedUserName string, matchID uuid.UUID) error
	NotifyNewLike(ctx context.Context, userID uuid.UUID) error
	NotifyUnmatch(ctx context.Context, matchID uuid.UUID, conversationID uuid.UUID, notifyUserID uuid.UUID) error
}

// Service handles matching business logic
type Service struct {
	db       *database.DB
	notifier MatchNotifier
}

// NewService creates a new matching service
func NewService(db *database.DB, notifier MatchNotifier) *Service {
	return &Service{
		db:       db,
		notifier: notifier,
	}
}

// SwipeResult represents the outcome of a swipe
type SwipeResult struct {
	Swiped  bool       `json:"swiped"`
	Matched bool       `json:"matched"`
	MatchID *uuid.UUID `json:"match_id,omitempty"`
}

// Swipe records a user's swipe on another user
func (s *Service) Swipe(ctx context.Context, swiperID, swipedID uuid.UUID, direction models.SwipeDirection) (*SwipeResult, error) {
	if swiperID == uuid.Nil || swipedID == uuid.Nil {
		return nil, ErrInvalidUserID
	}
	if swiperID == swipedID {
		return nil, ErrCannotSwipeSelf
	}
	if direction != models.SwipeLike && direction != models.SwipePass {
		return nil, ErrInvalidDirection
	}

	result := &SwipeResult{Swiped: true}

	// Start transaction
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Check if already swiped
	var exists bool
	err = tx.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM swipes WHERE swiper_id = $1 AND swiped_id = $2)",
		swiperID, swipedID,
	).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("check existing swipe: %w", err)
	}
	if exists {
		return nil, ErrAlreadySwiped
	}

	// Record the swipe
	_, err = tx.Exec(ctx,
		"INSERT INTO swipes (swiper_id, swiped_id, direction) VALUES ($1, $2, $3)",
		swiperID, swipedID, direction,
	)
	if err != nil {
		return nil, fmt.Errorf("insert swipe: %w", err)
	}

	// If this is a like, check for mutual match
	if direction == models.SwipeLike {
		var mutualLike bool
		err = tx.QueryRow(ctx,
			"SELECT EXISTS(SELECT 1 FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND direction = 'like')",
			swipedID, swiperID,
		).Scan(&mutualLike)
		if err != nil {
			return nil, fmt.Errorf("check mutual like: %w", err)
		}

		if mutualLike {
			// Create a match!
			userA, userB := models.OrderedUserIDs(swiperID, swipedID)
			var matchID uuid.UUID

			err = tx.QueryRow(ctx,
				"INSERT INTO matches (user_a, user_b) VALUES ($1, $2) RETURNING id",
				userA, userB,
			).Scan(&matchID)
			if err != nil {
				return nil, fmt.Errorf("create match: %w", err)
			}

			// Create conversation for the match
			_, err = tx.Exec(ctx,
				"INSERT INTO conversations (match_id, user_a_id, user_b_id) VALUES ($1, $2, $3)",
				matchID, userA, userB,
			)
			if err != nil {
				return nil, fmt.Errorf("create conversation: %w", err)
			}

			result.Matched = true
			result.MatchID = &matchID
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}

	// Send notifications (after commit, don't fail the swipe if notification fails)
	if s.notifier != nil {
		if result.Matched && result.MatchID != nil {
			// Get both users' names for the match notification
			swiperName, swipedName := s.getUserNames(ctx, swiperID, swipedID)

			// Notify both users of the match
			go s.notifier.NotifyNewMatch(ctx, swiperID, swipedName, *result.MatchID)
			go s.notifier.NotifyNewMatch(ctx, swipedID, swiperName, *result.MatchID)
		} else if direction == models.SwipeLike {
			// Notify the swiped user that someone liked them
			go s.notifier.NotifyNewLike(ctx, swipedID)
		}
	}

	return result, nil
}

// getUserNames fetches display names for two users in a single query
func (s *Service) getUserNames(ctx context.Context, userA, userB uuid.UUID) (string, string) {
	var nameA, nameB string = "Someone", "Someone"

	// Single query to fetch both names
	rows, err := s.db.Pool.Query(ctx,
		"SELECT id, COALESCE(display_name, 'Someone') FROM users WHERE id = ANY($1)",
		[]uuid.UUID{userA, userB},
	)
	if err != nil {
		return nameA, nameB
	}
	defer rows.Close()

	for rows.Next() {
		var id uuid.UUID
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			continue
		}
		if id == userA {
			nameA = name
		} else if id == userB {
			nameB = name
		}
	}

	return nameA, nameB
}

// GetMatches returns all active matches for a user
func (s *Service) GetMatches(ctx context.Context, userID uuid.UUID, limit, offset int) ([]models.MatchWithUser, error) {
	if userID == uuid.Nil {
		return nil, ErrInvalidUserID
	}

	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	rows, err := s.db.Pool.Query(ctx, `
		SELECT
			m.id, m.user_a, m.user_b, m.matched_at, m.unmatched_at,
			u.id, u.display_name, u.bio, u.profile_photo, u.verified
		FROM matches m
		JOIN users u ON (
			(m.user_a = $1 AND u.id = m.user_b) OR
			(m.user_b = $1 AND u.id = m.user_a)
		)
		WHERE (m.user_a = $1 OR m.user_b = $1)
			AND m.unmatched_at IS NULL
			AND u.deleted_at IS NULL
		ORDER BY m.matched_at DESC
		LIMIT $2 OFFSET $3
	`, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("query matches: %w", err)
	}
	defer rows.Close()

	var matches []models.MatchWithUser
	for rows.Next() {
		var m models.MatchWithUser
		var otherUser models.UserPublicProfile
		var displayName, bio, profilePhoto *string

		err := rows.Scan(
			&m.ID, &m.UserAID, &m.UserBID, &m.MatchedAt, &m.UnmatchedAt,
			&otherUser.ID, &displayName, &bio, &profilePhoto, &otherUser.Verified,
		)
		if err != nil {
			return nil, fmt.Errorf("scan match: %w", err)
		}

		otherUser.DisplayName = displayName
		otherUser.Bio = bio
		otherUser.ProfilePhoto = profilePhoto
		m.OtherUser = otherUser
		matches = append(matches, m)
	}

	return matches, nil
}

// Unmatch removes a match between two users
func (s *Service) Unmatch(ctx context.Context, userID, matchID uuid.UUID) error {
	if userID == uuid.Nil {
		return ErrInvalidUserID
	}
	if matchID == uuid.Nil {
		return ErrInvalidMatchID
	}

	// First, get the match details for notification
	var userA, userB uuid.UUID
	var conversationID uuid.UUID
	err := s.db.Pool.QueryRow(ctx, `
		SELECT m.user_a, m.user_b, c.id
		FROM matches m
		JOIN conversations c ON c.match_id = m.id
		WHERE m.id = $1 AND m.unmatched_at IS NULL
	`, matchID).Scan(&userA, &userB, &conversationID)
	if err == pgx.ErrNoRows {
		// Check if match exists at all
		var exists bool
		s.db.Pool.QueryRow(ctx,
			"SELECT EXISTS(SELECT 1 FROM matches WHERE id = $1)",
			matchID,
		).Scan(&exists)
		if !exists {
			return ErrMatchNotFound
		}
		return ErrAlreadyUnmatched
	}
	if err != nil {
		return fmt.Errorf("get match details: %w", err)
	}

	// Check if user is in the match
	if userA != userID && userB != userID {
		return ErrNotInMatch
	}

	// Perform the unmatch
	result, err := s.db.Pool.Exec(ctx, `
		UPDATE matches
		SET unmatched_at = $1
		WHERE id = $2
			AND (user_a = $3 OR user_b = $3)
			AND unmatched_at IS NULL
	`, time.Now(), matchID, userID)
	if err != nil {
		return fmt.Errorf("unmatch: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrAlreadyUnmatched
	}

	// Notify the other user
	if s.notifier != nil {
		var otherUserID uuid.UUID
		if userA == userID {
			otherUserID = userB
		} else {
			otherUserID = userA
		}
		go s.notifier.NotifyUnmatch(ctx, matchID, conversationID, otherUserID)
	}

	return nil
}

// GetDiscoverProfiles returns profiles for the discovery feed
func (s *Service) GetDiscoverProfiles(ctx context.Context, userID uuid.UUID, limit int) ([]models.DiscoverProfile, error) {
	if userID == uuid.Nil {
		return nil, ErrInvalidUserID
	}

	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	// Get profiles that:
	// 1. Are verified
	// 2. Haven't been swiped by this user
	// 3. Aren't already matched
	// 4. Aren't deleted
	// 5. Aren't the user themselves
	rows, err := s.db.Pool.Query(ctx, `
		SELECT u.id, u.display_name, u.bio, u.profile_photo, u.verified
		FROM users u
		WHERE u.verified = true
			AND u.deleted_at IS NULL
			AND u.id != $1
			AND NOT EXISTS (
				SELECT 1 FROM swipes s
				WHERE s.swiper_id = $1 AND s.swiped_id = u.id
			)
			AND NOT EXISTS (
				SELECT 1 FROM matches m
				WHERE (m.user_a = $1 AND m.user_b = u.id)
					OR (m.user_b = $1 AND m.user_a = u.id)
			)
		ORDER BY RANDOM()
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("query discover profiles: %w", err)
	}
	defer rows.Close()

	var profiles []models.DiscoverProfile
	for rows.Next() {
		var p models.DiscoverProfile
		var displayName, bio, profilePhoto *string

		err := rows.Scan(&p.ID, &displayName, &bio, &profilePhoto, &p.Verified)
		if err != nil {
			return nil, fmt.Errorf("scan profile: %w", err)
		}

		p.DisplayName = displayName
		p.Bio = bio
		p.ProfilePhoto = profilePhoto
		profiles = append(profiles, p)
	}

	return profiles, nil
}

// GetMatchedUserIDs returns the IDs of all users who have an active match with the given user.
// This implements the realtime.PresenceFilter interface.
func (s *Service) GetMatchedUserIDs(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT CASE WHEN user_a = $1 THEN user_b ELSE user_a END
		FROM matches
		WHERE (user_a = $1 OR user_b = $1)
			AND unmatched_at IS NULL
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("query matched users: %w", err)
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan matched user: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// GetPresenceRecipients implements realtime.PresenceFilter.
// It returns all matched user IDs for the given user.
func (s *Service) GetPresenceRecipients(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error) {
	return s.GetMatchedUserIDs(ctx, userID)
}

// GetMatchOtherUser returns the other user's ID in a match, or an error if the
// given user is not part of the match. This implements calls.MatchLookup.
func (s *Service) GetMatchOtherUser(ctx context.Context, matchID, userID uuid.UUID) (uuid.UUID, error) {
	var userA, userB uuid.UUID
	err := s.db.Pool.QueryRow(ctx, `
		SELECT user_a, user_b FROM matches
		WHERE id = $1 AND unmatched_at IS NULL
	`, matchID).Scan(&userA, &userB)
	if err == pgx.ErrNoRows {
		return uuid.Nil, ErrMatchNotFound
	}
	if err != nil {
		return uuid.Nil, fmt.Errorf("query match: %w", err)
	}

	switch userID {
	case userA:
		return userB, nil
	case userB:
		return userA, nil
	default:
		return uuid.Nil, ErrNotInMatch
	}
}

// GetMatch returns a specific match if the user is part of it
func (s *Service) GetMatch(ctx context.Context, userID, matchID uuid.UUID) (*models.MatchWithUser, error) {
	var m models.MatchWithUser
	var otherUser models.UserPublicProfile
	var displayName, bio, profilePhoto *string

	err := s.db.Pool.QueryRow(ctx, `
		SELECT
			m.id, m.user_a, m.user_b, m.matched_at, m.unmatched_at,
			u.id, u.display_name, u.bio, u.profile_photo, u.verified
		FROM matches m
		JOIN users u ON (
			(m.user_a = $1 AND u.id = m.user_b) OR
			(m.user_b = $1 AND u.id = m.user_a)
		)
		WHERE m.id = $2
			AND (m.user_a = $1 OR m.user_b = $1)
			AND u.deleted_at IS NULL
	`, userID, matchID).Scan(
		&m.ID, &m.UserAID, &m.UserBID, &m.MatchedAt, &m.UnmatchedAt,
		&otherUser.ID, &displayName, &bio, &profilePhoto, &otherUser.Verified,
	)

	if err == pgx.ErrNoRows {
		return nil, ErrMatchNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("query match: %w", err)
	}

	otherUser.DisplayName = displayName
	otherUser.Bio = bio
	otherUser.ProfilePhoto = profilePhoto
	m.OtherUser = otherUser

	return &m, nil
}
