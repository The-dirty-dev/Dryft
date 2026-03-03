package avatar

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
)

type mockAvatarHandlerService struct {
	getAvatarStateFn          func(ctx context.Context, userID uuid.UUID) (*AvatarState, error)
	updateAvatarStateFn       func(ctx context.Context, userID uuid.UUID, updates map[string]interface{}) error
	equipItemFn               func(ctx context.Context, userID uuid.UUID, itemID, itemType string) error
	unequipItemFn             func(ctx context.Context, userID uuid.UUID, itemType string) error
	setColorsFn               func(ctx context.Context, userID uuid.UUID, skinTone, hairColor, eyeColor string) error
	setDisplayNameFn          func(ctx context.Context, userID uuid.UUID, displayName string) error
	setVisibilityFn           func(ctx context.Context, userID uuid.UUID, visible bool) error
	getEquipHistoryFn         func(ctx context.Context, userID uuid.UUID, limit int) ([]EquipHistory, error)
	getMultipleAvatarStatesFn func(ctx context.Context, userIDs []uuid.UUID) (map[uuid.UUID]*AvatarState, error)
}

func (m *mockAvatarHandlerService) GetAvatarState(ctx context.Context, userID uuid.UUID) (*AvatarState, error) {
	if m.getAvatarStateFn == nil {
		return &AvatarState{}, nil
	}
	return m.getAvatarStateFn(ctx, userID)
}
func (m *mockAvatarHandlerService) UpdateAvatarState(ctx context.Context, userID uuid.UUID, updates map[string]interface{}) error {
	if m.updateAvatarStateFn == nil {
		return nil
	}
	return m.updateAvatarStateFn(ctx, userID, updates)
}
func (m *mockAvatarHandlerService) EquipItem(ctx context.Context, userID uuid.UUID, itemID, itemType string) error {
	if m.equipItemFn == nil {
		return nil
	}
	return m.equipItemFn(ctx, userID, itemID, itemType)
}
func (m *mockAvatarHandlerService) UnequipItem(ctx context.Context, userID uuid.UUID, itemType string) error {
	if m.unequipItemFn == nil {
		return nil
	}
	return m.unequipItemFn(ctx, userID, itemType)
}
func (m *mockAvatarHandlerService) SetColors(ctx context.Context, userID uuid.UUID, skinTone, hairColor, eyeColor string) error {
	if m.setColorsFn == nil {
		return nil
	}
	return m.setColorsFn(ctx, userID, skinTone, hairColor, eyeColor)
}
func (m *mockAvatarHandlerService) SetDisplayName(ctx context.Context, userID uuid.UUID, displayName string) error {
	if m.setDisplayNameFn == nil {
		return nil
	}
	return m.setDisplayNameFn(ctx, userID, displayName)
}
func (m *mockAvatarHandlerService) SetVisibility(ctx context.Context, userID uuid.UUID, visible bool) error {
	if m.setVisibilityFn == nil {
		return nil
	}
	return m.setVisibilityFn(ctx, userID, visible)
}
func (m *mockAvatarHandlerService) GetEquipHistory(ctx context.Context, userID uuid.UUID, limit int) ([]EquipHistory, error) {
	if m.getEquipHistoryFn == nil {
		return []EquipHistory{}, nil
	}
	return m.getEquipHistoryFn(ctx, userID, limit)
}
func (m *mockAvatarHandlerService) GetMultipleAvatarStates(ctx context.Context, userIDs []uuid.UUID) (map[uuid.UUID]*AvatarState, error) {
	if m.getMultipleAvatarStatesFn == nil {
		return map[uuid.UUID]*AvatarState{}, nil
	}
	return m.getMultipleAvatarStatesFn(ctx, userIDs)
}

func setAvatarUser(req *http.Request, userID uuid.UUID) *http.Request {
	return req.WithContext(context.WithValue(req.Context(), "user_id", userID))
}

func TestGetMyAvatarState_Success(t *testing.T) {
	userID := uuid.New()
	h := &Handler{service: &mockAvatarHandlerService{
		getAvatarStateFn: func(_ context.Context, gotUserID uuid.UUID) (*AvatarState, error) {
			if gotUserID != userID {
				t.Fatalf("unexpected user id: %s", gotUserID)
			}
			return &AvatarState{UserID: userID}, nil
		},
	}}

	req := setAvatarUser(httptest.NewRequest(http.MethodGet, "/avatar", nil), userID)
	rec := httptest.NewRecorder()
	h.GetMyAvatarState(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestUpdateAvatarState_NoUpdatesValidation(t *testing.T) {
	h := &Handler{service: &mockAvatarHandlerService{}}
	req := setAvatarUser(httptest.NewRequest(http.MethodPut, "/avatar", bytes.NewBufferString(`{}`)), uuid.New())
	rec := httptest.NewRecorder()
	h.UpdateAvatarState(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestEquipAndUnequipItem_Flows(t *testing.T) {
	userID := uuid.New()
	h := &Handler{service: &mockAvatarHandlerService{
		equipItemFn: func(_ context.Context, gotUserID uuid.UUID, itemID, itemType string) error {
			if gotUserID != userID || itemID != "item-1" || itemType != "outfit" {
				t.Fatalf("unexpected equip args")
			}
			return nil
		},
		unequipItemFn: func(_ context.Context, gotUserID uuid.UUID, itemType string) error {
			if gotUserID != userID || itemType != "outfit" {
				t.Fatalf("unexpected unequip args")
			}
			return nil
		},
	}}

	equipReq := setAvatarUser(httptest.NewRequest(http.MethodPost, "/avatar/equip", bytes.NewBufferString(`{"item_id":"item-1","item_type":"outfit"}`)), userID)
	equipRec := httptest.NewRecorder()
	h.EquipItem(equipRec, equipReq)
	if equipRec.Code != http.StatusOK {
		t.Fatalf("expected equip 200, got %d", equipRec.Code)
	}

	unequipReq := setAvatarUser(httptest.NewRequest(http.MethodPost, "/avatar/unequip", bytes.NewBufferString(`{"item_type":"outfit"}`)), userID)
	unequipRec := httptest.NewRecorder()
	h.UnequipItem(unequipRec, unequipReq)
	if unequipRec.Code != http.StatusOK {
		t.Fatalf("expected unequip 200, got %d", unequipRec.Code)
	}
}

func TestSetColors_InvalidJSONFlow(t *testing.T) {
	h := &Handler{service: &mockAvatarHandlerService{}}
	req := setAvatarUser(httptest.NewRequest(http.MethodPut, "/avatar/colors", bytes.NewBufferString(`bad`)), uuid.New())
	rec := httptest.NewRecorder()
	h.SetColors(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestGetMultipleAvatarStates_Success(t *testing.T) {
	u1 := uuid.New()
	u2 := uuid.New()
	h := &Handler{service: &mockAvatarHandlerService{
		getMultipleAvatarStatesFn: func(_ context.Context, userIDs []uuid.UUID) (map[uuid.UUID]*AvatarState, error) {
			if len(userIDs) != 2 {
				t.Fatalf("expected 2 user IDs, got %d", len(userIDs))
			}
			return map[uuid.UUID]*AvatarState{
				u1: {UserID: u1},
				u2: {UserID: u2},
			}, nil
		},
	}}

	req := httptest.NewRequest(http.MethodPost, "/avatar/batch", bytes.NewBufferString(`{"user_ids":["`+u1.String()+`","`+u2.String()+`"]}`))
	rec := httptest.NewRecorder()
	h.GetMultipleAvatarStates(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
