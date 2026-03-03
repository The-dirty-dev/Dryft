package avatar

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

func TestEquipItem_InvalidTypeRejected(t *testing.T) {
	svc := &Service{}
	err := svc.EquipItem(context.Background(), uuid.New(), "item-1", "unsupported")
	if err == nil || err.Error() != "invalid item type" {
		t.Fatalf("expected invalid item type error, got %v", err)
	}
}

func TestSetColors_NoUpdatesNoop(t *testing.T) {
	svc := &Service{}
	err := svc.SetColors(context.Background(), uuid.New(), "", "", "")
	if err != nil {
		t.Fatalf("expected no-op color update to succeed, got %v", err)
	}
}
