package matching

import (
	"context"
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
