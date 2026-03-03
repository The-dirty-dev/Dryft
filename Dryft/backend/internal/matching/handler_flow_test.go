package matching

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/models"
)

type mockMatchingHandlerService struct {
	swipeFn               func(ctx context.Context, swiperID, swipedID uuid.UUID, direction models.SwipeDirection) (*SwipeResult, error)
	getDiscoverProfilesFn func(ctx context.Context, userID uuid.UUID, limit int) ([]models.DiscoverProfile, error)
	getMatchesFn          func(ctx context.Context, userID uuid.UUID, limit, offset int) ([]models.MatchWithUser, error)
	getMatchFn            func(ctx context.Context, userID, matchID uuid.UUID) (*models.MatchWithUser, error)
	unmatchFn             func(ctx context.Context, userID, matchID uuid.UUID) error
}

func (m *mockMatchingHandlerService) Swipe(ctx context.Context, swiperID, swipedID uuid.UUID, direction models.SwipeDirection) (*SwipeResult, error) {
	if m.swipeFn == nil {
		return nil, errors.New("not implemented")
	}
	return m.swipeFn(ctx, swiperID, swipedID, direction)
}

func (m *mockMatchingHandlerService) GetDiscoverProfiles(ctx context.Context, userID uuid.UUID, limit int) ([]models.DiscoverProfile, error) {
	if m.getDiscoverProfilesFn == nil {
		return nil, errors.New("not implemented")
	}
	return m.getDiscoverProfilesFn(ctx, userID, limit)
}

func (m *mockMatchingHandlerService) GetMatches(ctx context.Context, userID uuid.UUID, limit, offset int) ([]models.MatchWithUser, error) {
	if m.getMatchesFn == nil {
		return nil, errors.New("not implemented")
	}
	return m.getMatchesFn(ctx, userID, limit, offset)
}

func (m *mockMatchingHandlerService) GetMatch(ctx context.Context, userID, matchID uuid.UUID) (*models.MatchWithUser, error) {
	if m.getMatchFn == nil {
		return nil, errors.New("not implemented")
	}
	return m.getMatchFn(ctx, userID, matchID)
}

func (m *mockMatchingHandlerService) Unmatch(ctx context.Context, userID, matchID uuid.UUID) error {
	if m.unmatchFn == nil {
		return errors.New("not implemented")
	}
	return m.unmatchFn(ctx, userID, matchID)
}

func setMatchingUser(req *http.Request, userID uuid.UUID) *http.Request {
	ctx := context.WithValue(req.Context(), userIDContextKey, userID)
	return req.WithContext(ctx)
}

func TestHandlerSwipe_ParsesLikeAndPass(t *testing.T) {
	userID := uuid.New()
	targetID := uuid.New()
	calls := 0

	h := &Handler{
		service: &mockMatchingHandlerService{
			swipeFn: func(_ context.Context, swiperID, swipedID uuid.UUID, direction models.SwipeDirection) (*SwipeResult, error) {
				calls++
				if swiperID != userID || swipedID != targetID {
					t.Fatalf("unexpected IDs swiper=%s swiped=%s", swiperID, swipedID)
				}
				if direction != models.SwipeLike && direction != models.SwipePass {
					t.Fatalf("unexpected direction: %s", direction)
				}
				return &SwipeResult{Swiped: true, Matched: false}, nil
			},
		},
	}

	tests := []string{"like", "pass"}
	for _, direction := range tests {
		req := httptest.NewRequest(http.MethodPost, "/v1/discover/swipe", strings.NewReader(`{"user_id":"`+targetID.String()+`","direction":"`+direction+`"}`))
		req = setMatchingUser(req, userID)
		rec := httptest.NewRecorder()
		h.Swipe(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("direction %s: expected 200, got %d", direction, rec.Code)
		}
	}

	if calls != 2 {
		t.Fatalf("expected 2 swipe calls, got %d", calls)
	}
}

func TestHandlerSwipe_ReturnsMatchedPayload(t *testing.T) {
	userID := uuid.New()
	targetID := uuid.New()
	matchID := uuid.New()

	h := &Handler{
		service: &mockMatchingHandlerService{
			swipeFn: func(_ context.Context, _, _ uuid.UUID, _ models.SwipeDirection) (*SwipeResult, error) {
				return &SwipeResult{Swiped: true, Matched: true, MatchID: &matchID}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/discover/swipe", strings.NewReader(`{"user_id":"`+targetID.String()+`","direction":"like"}`))
	req = setMatchingUser(req, userID)
	rec := httptest.NewRecorder()
	h.Swipe(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body SwipeResult
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !body.Matched || body.MatchID == nil {
		t.Fatalf("expected matched payload, got %+v", body)
	}
}

func TestHandlerSwipe_RejectsUnsupportedDirection(t *testing.T) {
	h := &Handler{service: &mockMatchingHandlerService{}}
	req := httptest.NewRequest(http.MethodPost, "/v1/discover/swipe", strings.NewReader(`{"user_id":"`+uuid.NewString()+`","direction":"superlike"}`))
	req = setMatchingUser(req, uuid.New())
	rec := httptest.NewRecorder()
	h.Swipe(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestHandlerGetDiscoverProfiles_PassesLimit(t *testing.T) {
	userID := uuid.New()
	called := false

	h := &Handler{
		service: &mockMatchingHandlerService{
			getDiscoverProfilesFn: func(_ context.Context, gotUserID uuid.UUID, limit int) ([]models.DiscoverProfile, error) {
				called = true
				if gotUserID != userID {
					t.Fatalf("unexpected userID: %s", gotUserID)
				}
				if limit != 12 {
					t.Fatalf("expected limit=12, got %d", limit)
				}
				return []models.DiscoverProfile{}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/discover?limit=12", nil)
	req = setMatchingUser(req, userID)
	rec := httptest.NewRecorder()
	h.GetDiscoverProfiles(rec, req)

	if !called {
		t.Fatal("expected service GetDiscoverProfiles call")
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestHandlerGetMatches_PassesPagination(t *testing.T) {
	userID := uuid.New()
	called := false

	h := &Handler{
		service: &mockMatchingHandlerService{
			getMatchesFn: func(_ context.Context, gotUserID uuid.UUID, limit, offset int) ([]models.MatchWithUser, error) {
				called = true
				if gotUserID != userID {
					t.Fatalf("unexpected userID: %s", gotUserID)
				}
				if limit != 25 || offset != 4 {
					t.Fatalf("unexpected pagination values limit=%d offset=%d", limit, offset)
				}
				return []models.MatchWithUser{}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/matches?limit=25&offset=4", nil)
	req = setMatchingUser(req, userID)
	rec := httptest.NewRecorder()
	h.GetMatches(rec, req)

	if !called {
		t.Fatal("expected service GetMatches call")
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
