package matching

import (
	"fmt"
	"testing"

	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/models"
)

func BenchmarkDiscoverQueryConstruction(b *testing.B) {
	b.ReportAllocs()
	userID := uuid.New()
	for i := 0; i < b.N; i++ {
		_ = fmt.Sprintf(`
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
			LIMIT $2 -- %s
		`, userID)
	}
}

func BenchmarkLikePassProcessing(b *testing.B) {
	b.ReportAllocs()
	swiper := uuid.New()
	swiped := uuid.New()
	directions := []models.SwipeDirection{models.SwipeLike, models.SwipePass}

	for i := 0; i < b.N; i++ {
		direction := directions[i%len(directions)]
		res := &SwipeResult{Swiped: true}
		if direction == models.SwipeLike {
			matchID := uuid.New()
			res.Matched = true
			res.MatchID = &matchID
		}
		_, _ = models.OrderedUserIDs(swiper, swiped)
	}
}

func BenchmarkDistanceCalculation(b *testing.B) {
	b.ReportAllocs()
	// Approximate haversine-style math from profile filtering pipelines.
	latA, lonA := 34.0522, -118.2437
	latB, lonB := 37.7749, -122.4194

	for i := 0; i < b.N; i++ {
		dLat := latB - latA
		dLon := lonB - lonA
		distance := (dLat * dLat) + (dLon * dLon)
		if distance < 0 {
			b.Fatalf("unexpected distance: %f", distance)
		}
	}
}
