package matching

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/models"
)

func TestSwipeDirectionConstants(t *testing.T) {
	tests := []struct {
		name     string
		dir      models.SwipeDirection
		expected string
	}{
		{"SwipeLike value", models.SwipeLike, "like"},
		{"SwipePass value", models.SwipePass, "pass"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if string(tc.dir) != tc.expected {
				t.Errorf("expected %q, got %q", tc.expected, string(tc.dir))
			}
		})
	}
}

func TestSwipeDirectionTypes(t *testing.T) {
	// Ensure SwipeLike and SwipePass are distinct
	if models.SwipeLike == models.SwipePass {
		t.Error("SwipeLike and SwipePass should be different values")
	}
}

func TestOrderedUserIDs(t *testing.T) {
	// Create two UUIDs where we know the string ordering
	idA := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	idB := uuid.MustParse("ffffffff-ffff-ffff-ffff-ffffffffffff")

	tests := []struct {
		name        string
		a           uuid.UUID
		b           uuid.UUID
		expectedLow uuid.UUID
		expectedHi  uuid.UUID
	}{
		{
			name:        "a < b returns (a, b)",
			a:           idA,
			b:           idB,
			expectedLow: idA,
			expectedHi:  idB,
		},
		{
			name:        "b < a returns (a, b) - reversed input",
			a:           idB,
			b:           idA,
			expectedLow: idA,
			expectedHi:  idB,
		},
		{
			name:        "same UUID returns (a, a)",
			a:           idA,
			b:           idA,
			expectedLow: idA,
			expectedHi:  idA,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			low, hi := models.OrderedUserIDs(tc.a, tc.b)
			if low != tc.expectedLow {
				t.Errorf("expected low=%s, got %s", tc.expectedLow, low)
			}
			if hi != tc.expectedHi {
				t.Errorf("expected hi=%s, got %s", tc.expectedHi, hi)
			}
		})
	}
}

func TestOrderedUserIDs_ConsistentOrdering(t *testing.T) {
	// The primary use case: regardless of input order, output is consistent
	a := uuid.New()
	b := uuid.New()

	low1, hi1 := models.OrderedUserIDs(a, b)
	low2, hi2 := models.OrderedUserIDs(b, a)

	if low1 != low2 {
		t.Errorf("inconsistent low: OrderedUserIDs(a,b)=%s but OrderedUserIDs(b,a)=%s", low1, low2)
	}
	if hi1 != hi2 {
		t.Errorf("inconsistent hi: OrderedUserIDs(a,b)=%s but OrderedUserIDs(b,a)=%s", hi1, hi2)
	}
}

func TestOrderedUserIDs_LowIsAlwaysSmaller(t *testing.T) {
	for i := 0; i < 20; i++ {
		a := uuid.New()
		b := uuid.New()

		low, hi := models.OrderedUserIDs(a, b)

		if low.String() > hi.String() {
			t.Errorf("iteration %d: expected low <= hi, got low=%s > hi=%s", i, low, hi)
		}
	}
}

func TestErrorVariables(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected string
	}{
		{"ErrAlreadySwiped", ErrAlreadySwiped, "already swiped on this user"},
		{"ErrCannotSwipeSelf", ErrCannotSwipeSelf, "cannot swipe on yourself"},
		{"ErrMatchNotFound", ErrMatchNotFound, "match not found"},
		{"ErrNotInMatch", ErrNotInMatch, "you are not part of this match"},
		{"ErrAlreadyUnmatched", ErrAlreadyUnmatched, "already unmatched"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if tc.err == nil {
				t.Fatalf("expected non-nil error for %s", tc.name)
			}
			if tc.err.Error() != tc.expected {
				t.Errorf("expected error message %q, got %q", tc.expected, tc.err.Error())
			}
		})
	}
}

func TestErrorVariables_AreDistinct(t *testing.T) {
	errors := []error{
		ErrAlreadySwiped,
		ErrCannotSwipeSelf,
		ErrMatchNotFound,
		ErrNotInMatch,
		ErrAlreadyUnmatched,
	}

	seen := make(map[string]bool)
	for _, err := range errors {
		msg := err.Error()
		if seen[msg] {
			t.Errorf("duplicate error message: %q", msg)
		}
		seen[msg] = true
	}
}

func TestMatchIsActive(t *testing.T) {
	t.Run("active match (nil UnmatchedAt)", func(t *testing.T) {
		m := &models.Match{
			ID:          uuid.New(),
			UnmatchedAt: nil,
		}
		if !m.IsActive() {
			t.Error("expected IsActive()=true for match with nil UnmatchedAt")
		}
	})

	t.Run("inactive match (non-nil UnmatchedAt)", func(t *testing.T) {
		now := time.Now()
		m := &models.Match{
			ID:          uuid.New(),
			UnmatchedAt: &now,
		}
		if m.IsActive() {
			t.Error("expected IsActive()=false for match with non-nil UnmatchedAt")
		}
	})
}

func TestMatchGetOtherUserID(t *testing.T) {
	userA := uuid.New()
	userB := uuid.New()

	m := &models.Match{
		ID:      uuid.New(),
		UserAID: userA,
		UserBID: userB,
	}

	t.Run("get other user when I am userA", func(t *testing.T) {
		other := m.GetOtherUserID(userA)
		if other != userB {
			t.Errorf("expected %s, got %s", userB, other)
		}
	})

	t.Run("get other user when I am userB", func(t *testing.T) {
		other := m.GetOtherUserID(userB)
		if other != userA {
			t.Errorf("expected %s, got %s", userA, other)
		}
	})
}
