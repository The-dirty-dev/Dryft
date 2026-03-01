//go:build integration

package matching

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/models"
	"github.com/dryft-app/backend/internal/testutil"
)

func TestServiceSwipeCreatesMatch(t *testing.T) {
	tdb, err := testutil.SetupTestDB()
	if err != nil {
		t.Fatalf("setup db: %v", err)
	}
	defer tdb.Teardown()

	ctx := context.Background()

	userA, err := testutil.CreateTestUser(tdb, "match-a@example.com", "password")
	if err != nil {
		t.Fatalf("create user A: %v", err)
	}
	userB, err := testutil.CreateTestUser(tdb, "match-b@example.com", "password")
	if err != nil {
		t.Fatalf("create user B: %v", err)
	}

	// Seed a like from userB -> userA to create a mutual match.
	_, err = tdb.DB.Pool.Exec(ctx,
		"INSERT INTO swipes (swiper_id, swiped_id, direction) VALUES ($1, $2, $3)",
		userB, userA, models.SwipeLike,
	)
	if err != nil {
		t.Fatalf("seed swipe: %v", err)
	}

	svc := NewService(tdb.DB, nil)
	result, err := svc.Swipe(ctx, userA, userB, models.SwipeLike)
	if err != nil {
		t.Fatalf("swipe: %v", err)
	}
	if result == nil || !result.Matched || result.MatchID == nil {
		t.Fatalf("expected match result, got %+v", result)
	}

	var matchCount int
	if err := tdb.DB.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM matches WHERE id = $1", *result.MatchID).Scan(&matchCount); err != nil {
		t.Fatalf("query match: %v", err)
	}
	if matchCount != 1 {
		t.Fatalf("expected match row, got %d", matchCount)
	}

	var convoCount int
	if err := tdb.DB.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM conversations WHERE match_id = $1", *result.MatchID).Scan(&convoCount); err != nil {
		t.Fatalf("query conversation: %v", err)
	}
	if convoCount != 1 {
		t.Fatalf("expected conversation row, got %d", convoCount)
	}
}

func TestServiceSwipeRejectsSelfSwipe(t *testing.T) {
	svc := NewService(nil, nil)
	user := uuid.New()
	if _, err := svc.Swipe(context.Background(), user, user, models.SwipeLike); err != ErrCannotSwipeSelf {
		t.Fatalf("expected ErrCannotSwipeSelf, got %v", err)
	}
}

func TestServiceSwipeRejectsDuplicateSwipe(t *testing.T) {
	tdb, err := testutil.SetupTestDB()
	if err != nil {
		t.Fatalf("setup db: %v", err)
	}
	defer tdb.Teardown()

	ctx := context.Background()

	userA, err := testutil.CreateTestUser(tdb, "dup-a@example.com", "password")
	if err != nil {
		t.Fatalf("create user A: %v", err)
	}
	userB, err := testutil.CreateTestUser(tdb, "dup-b@example.com", "password")
	if err != nil {
		t.Fatalf("create user B: %v", err)
	}

	_, err = tdb.DB.Pool.Exec(ctx,
		"INSERT INTO swipes (swiper_id, swiped_id, direction) VALUES ($1, $2, $3)",
		userA, userB, models.SwipeLike,
	)
	if err != nil {
		t.Fatalf("seed swipe: %v", err)
	}

	svc := NewService(tdb.DB, nil)
	if _, err := svc.Swipe(ctx, userA, userB, models.SwipeLike); err != ErrAlreadySwiped {
		t.Fatalf("expected ErrAlreadySwiped, got %v", err)
	}
}
