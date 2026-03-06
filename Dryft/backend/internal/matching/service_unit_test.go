package matching

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/models"
)

func TestServiceSwipe_RejectsSelfSwipeWithoutDB(t *testing.T) {
	svc := NewService(nil, nil)
	userID := uuid.New()

	tests := []models.SwipeDirection{models.SwipeLike, models.SwipePass}
	for _, direction := range tests {
		_, err := svc.Swipe(context.Background(), userID, userID, direction)
		if err != ErrCannotSwipeSelf {
			t.Fatalf("direction %s: expected ErrCannotSwipeSelf, got %v", direction, err)
		}
	}
}

func TestSwipe_RejectsInvalidDirection(t *testing.T) {
	svc := NewService(nil, nil)
	_, err := svc.Swipe(context.Background(), uuid.New(), uuid.New(), models.SwipeDirection("super"))
	if !errors.Is(err, ErrInvalidDirection) {
		t.Fatalf("expected ErrInvalidDirection, got %v", err)
	}
}

func TestSwipe_RejectsZeroUUID(t *testing.T) {
	svc := NewService(nil, nil)

	_, err := svc.Swipe(context.Background(), uuid.Nil, uuid.New(), models.SwipeLike)
	if !errors.Is(err, ErrInvalidUserID) {
		t.Fatalf("expected ErrInvalidUserID for zero swiper, got %v", err)
	}

	_, err = svc.Swipe(context.Background(), uuid.New(), uuid.Nil, models.SwipePass)
	if !errors.Is(err, ErrInvalidUserID) {
		t.Fatalf("expected ErrInvalidUserID for zero swiped user, got %v", err)
	}
}

func TestGetMatches_RejectsZeroUserID(t *testing.T) {
	svc := NewService(nil, nil)
	_, err := svc.GetMatches(context.Background(), uuid.Nil, 20, 0)
	if !errors.Is(err, ErrInvalidUserID) {
		t.Fatalf("expected ErrInvalidUserID, got %v", err)
	}
}

func TestUnmatch_RejectsZeroMatchID(t *testing.T) {
	svc := NewService(nil, nil)
	err := svc.Unmatch(context.Background(), uuid.New(), uuid.Nil)
	if !errors.Is(err, ErrInvalidMatchID) {
		t.Fatalf("expected ErrInvalidMatchID, got %v", err)
	}
}

func TestGetDiscoverProfiles_RejectsZeroUserID(t *testing.T) {
	svc := NewService(nil, nil)
	_, err := svc.GetDiscoverProfiles(context.Background(), uuid.Nil, 10)
	if !errors.Is(err, ErrInvalidUserID) {
		t.Fatalf("expected ErrInvalidUserID, got %v", err)
	}
}
