//go:build integration

package testutil

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// CreateTestUser inserts a verified user and returns their ID.
func CreateTestUser(tdb *TestDB, email, password string) (uuid.UUID, error) {
	userID := uuid.New()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return uuid.Nil, fmt.Errorf("hash password: %w", err)
	}

	_, err = tdb.DB.Pool.Exec(context.Background(), `
		INSERT INTO users (id, email, password_hash, display_name, date_of_birth, is_verified, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
	`, userID, email, string(hash), "TestUser", time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC))
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert test user: %w", err)
	}

	return userID, nil
}

// CreateTestMatch creates a match between two users and returns the match ID and conversation ID.
func CreateTestMatch(tdb *TestDB, userA, userB uuid.UUID) (matchID, conversationID uuid.UUID, err error) {
	matchID = uuid.New()
	conversationID = uuid.New()

	_, err = tdb.DB.Pool.Exec(context.Background(), `
		INSERT INTO matches (id, user_a, user_b, matched_at)
		VALUES ($1, $2, $3, NOW())
	`, matchID, userA, userB)
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("insert match: %w", err)
	}

	_, err = tdb.DB.Pool.Exec(context.Background(), `
		INSERT INTO conversations (id, match_id, created_at, updated_at)
		VALUES ($1, $2, NOW(), NOW())
	`, conversationID, matchID)
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("insert conversation: %w", err)
	}

	return matchID, conversationID, nil
}
