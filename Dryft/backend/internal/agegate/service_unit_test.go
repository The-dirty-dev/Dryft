package agegate

import (
	"testing"
	"time"

	"github.com/dryft-app/backend/internal/config"
)

func TestCompareFromJumio_Thresholds(t *testing.T) {
	matcher := NewFaceMatchService(&config.Config{
		FaceMatchThreshold:       0.80,
		FaceMatchManualReviewMin: 0.60,
	})

	tests := []struct {
		name       string
		score      float64
		wantPass   bool
		wantReview bool
	}{
		{name: "passes at threshold", score: 0.80, wantPass: true, wantReview: false},
		{name: "manual review band", score: 0.65, wantPass: false, wantReview: true},
		{name: "below review threshold", score: 0.40, wantPass: false, wantReview: false},
		{name: "jumio unavailable", score: -1, wantPass: false, wantReview: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			res := matcher.CompareFromJumio(tc.score)
			if res.Passed != tc.wantPass || res.NeedsReview != tc.wantReview {
				t.Fatalf("unexpected result: %+v", res)
			}
		})
	}
}

func TestDetermineVerificationOutcome(t *testing.T) {
	matcher := NewFaceMatchService(&config.Config{FaceMatchThreshold: 0.8, FaceMatchManualReviewMin: 0.6})

	outcome := matcher.DetermineVerificationOutcome(false, true, true, &FaceMatchResult{Passed: true})
	if outcome.Status != "PENDING" {
		t.Fatalf("expected pending when card is not verified, got %+v", outcome)
	}

	outcome = matcher.DetermineVerificationOutcome(true, true, false, &FaceMatchResult{Passed: true})
	if outcome.Status != "REJECTED" {
		t.Fatalf("expected rejected for underage user, got %+v", outcome)
	}

	outcome = matcher.DetermineVerificationOutcome(true, true, true, &FaceMatchResult{NeedsReview: true})
	if outcome.Status != "MANUAL_REVIEW" {
		t.Fatalf("expected manual review when face check is inconclusive, got %+v", outcome)
	}

	outcome = matcher.DetermineVerificationOutcome(true, true, true, &FaceMatchResult{Passed: true})
	if outcome.Status != "VERIFIED" {
		t.Fatalf("expected verified when all checks pass, got %+v", outcome)
	}
}

func TestServiceUnitNullString(t *testing.T) {
	if got := nullString(""); got != nil {
		t.Fatalf("expected nil for empty input, got %v", got)
	}
	if got := nullString("ok"); got == nil || *got != "ok" {
		t.Fatalf("expected pointer to value, got %v", got)
	}
}

func TestAgeBoundaryReferenceDate(t *testing.T) {
	now := time.Now().UTC()
	dobAdult := now.AddDate(-18, 0, -1) // safely older than 18
	dobMinor := now.AddDate(-18, 0, 1)  // one day too young

	client := NewJumioClient(&config.Config{})
	if !client.IsAdult(&dobAdult) {
		t.Fatal("expected 18+ DOB to be considered adult")
	}
	if client.IsAdult(&dobMinor) {
		t.Fatal("expected under-18 DOB to be considered minor")
	}
}
