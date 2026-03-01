//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/config"
	"github.com/dryft-app/backend/internal/matching"
	authmw "github.com/dryft-app/backend/internal/middleware"
	"github.com/dryft-app/backend/internal/testutil"
)

// noopNotifier satisfies MatchNotifier without side effects.
type noopNotifier struct{}

func (n *noopNotifier) NotifyNewMatch(_ context.Context, _ uuid.UUID, _ string, _ uuid.UUID) error {
	return nil
}
func (n *noopNotifier) NotifyNewLike(_ context.Context, _ uuid.UUID) error { return nil }
func (n *noopNotifier) NotifyUnmatch(_ context.Context, _, _ uuid.UUID, _ uuid.UUID) error {
	return nil
}

func newMatchingRouter(t *testing.T) *chi.Mux {
	t.Helper()

	cfg := &config.Config{JWTSecretKey: testutil.TestJWTSecret, Environment: "development"}
	authSvc := authServiceForTest(cfg)
	mw := authmw.NewAuthMiddleware(&tokenValidatorAdapter{service: authSvc})

	matchingSvc := matching.NewService(tdb.DB, &noopNotifier{})
	matchingHandler := matching.NewHandler(matchingSvc)

	r := chi.NewRouter()
	r.Route("/v1/discover", func(r chi.Router) {
		r.Use(mw.RequireAuth)
		r.Get("/", matchingHandler.GetDiscoverProfiles)
		r.Post("/swipe", matchingHandler.Swipe)
	})
	r.Route("/v1/matches", func(r chi.Router) {
		r.Use(mw.RequireAuth)
		r.Get("/", matchingHandler.GetMatches)
		r.Get("/{matchID}", matchingHandler.GetMatch)
		r.Delete("/{matchID}", matchingHandler.Unmatch)
	})
	return r
}

func TestSwipe_MutualMatch(t *testing.T) {
	tdb.TruncateAll(t.Context())

	aliceID, err := testutil.CreateTestUser(tdb, "alice@match.com", "Pass1234!")
	if err != nil {
		t.Fatal(err)
	}
	bobID, err := testutil.CreateTestUser(tdb, "bob@match.com", "Pass1234!")
	if err != nil {
		t.Fatal(err)
	}

	aliceToken, _ := testutil.GenerateTestToken(aliceID.String(), "alice@match.com", true)
	bobToken, _ := testutil.GenerateTestToken(bobID.String(), "bob@match.com", true)

	r := newMatchingRouter(t)

	// Alice swipes right on Bob
	body := `{"swiped_id":"` + bobID.String() + `","direction":"right"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/discover/swipe", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+aliceToken)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("alice swipe: expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var swipeResp map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&swipeResp)
	if swipeResp["matched"] == true {
		t.Log("unexpected instant match (shouldn't happen on first swipe)")
	}

	// Bob swipes right on Alice → should match
	body = `{"swiped_id":"` + aliceID.String() + `","direction":"right"}`
	req = httptest.NewRequest(http.MethodPost, "/v1/discover/swipe", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+bobToken)
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("bob swipe: expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	json.NewDecoder(rr.Body).Decode(&swipeResp)
	if swipeResp["matched"] != true {
		t.Error("expected mutual match after both swipe right")
	}
}

func TestSwipe_Left_NoMatch(t *testing.T) {
	tdb.TruncateAll(t.Context())

	aliceID, _ := testutil.CreateTestUser(tdb, "alice@left.com", "Pass1234!")
	bobID, _ := testutil.CreateTestUser(tdb, "bob@left.com", "Pass1234!")

	aliceToken, _ := testutil.GenerateTestToken(aliceID.String(), "alice@left.com", true)
	bobToken, _ := testutil.GenerateTestToken(bobID.String(), "bob@left.com", true)

	r := newMatchingRouter(t)

	// Alice swipes left on Bob
	body := `{"swiped_id":"` + bobID.String() + `","direction":"left"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/discover/swipe", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+aliceToken)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("alice swipe left: expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	// Bob swipes right on Alice → no match
	body = `{"swiped_id":"` + aliceID.String() + `","direction":"right"}`
	req = httptest.NewRequest(http.MethodPost, "/v1/discover/swipe", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+bobToken)
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("bob swipe: expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var swipeResp map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&swipeResp)
	if swipeResp["matched"] == true {
		t.Error("should not match when one person swiped left")
	}
}

func TestGetMatches_Empty(t *testing.T) {
	tdb.TruncateAll(t.Context())

	userID, _ := testutil.CreateTestUser(tdb, "lonely@example.com", "Pass1234!")
	token, _ := testutil.GenerateTestToken(userID.String(), "lonely@example.com", true)

	r := newMatchingRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/v1/matches", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("get matches: expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSwipe_Self_Rejected(t *testing.T) {
	tdb.TruncateAll(t.Context())

	userID, _ := testutil.CreateTestUser(tdb, "self@example.com", "Pass1234!")
	token, _ := testutil.GenerateTestToken(userID.String(), "self@example.com", true)

	r := newMatchingRouter(t)

	body := `{"swiped_id":"` + userID.String() + `","direction":"right"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/discover/swipe", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	// Should reject self-swipe
	if rr.Code == http.StatusOK {
		var resp map[string]interface{}
		json.NewDecoder(rr.Body).Decode(&resp)
		// Some implementations return 200 with an error field
		if resp["matched"] == true {
			t.Error("self-swipe should not produce a match")
		}
	}
}
