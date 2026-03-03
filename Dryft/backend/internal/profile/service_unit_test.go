package profile

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/dryft-app/backend/internal/models"
)

type mockPhotoSigner struct {
	getSignedURLFn func(key string) (string, error)
}

func (m *mockPhotoSigner) GetSignedURL(key string) (string, error) {
	if m.getSignedURLFn == nil {
		return "", nil
	}
	return m.getSignedURLFn(key)
}

func TestUpdateProfile_RejectsLongInterest(t *testing.T) {
	svc := &Service{}
	tooLong := strings.Repeat("x", 51)
	_, err := svc.UpdateProfile(context.Background(), models.User{}.ID, &UpdateProfileRequest{
		Interests: []string{tooLong},
	})
	if !errors.Is(err, ErrInvalidInterest) {
		t.Fatalf("expected ErrInvalidInterest, got %v", err)
	}
}

func TestUpdateProfile_RejectsInvalidBirthDateFormat(t *testing.T) {
	svc := &Service{}
	badDate := "03/03/2026"
	_, err := svc.UpdateProfile(context.Background(), models.User{}.ID, &UpdateProfileRequest{
		BirthDate: &badDate,
	})
	if err == nil || !strings.Contains(err.Error(), "invalid birth date format") {
		t.Fatalf("expected birth date format error, got %v", err)
	}
}

func TestUserToProfileResponse_SignedPhotoAndAge(t *testing.T) {
	now := time.Date(2026, 3, 3, 12, 0, 0, 0, time.UTC)
	birthDate := now.AddDate(-25, 0, 0)
	photoKey := "profiles/user/main.jpg"
	city := "Los Angeles"

	user := &models.User{
		Email:        "test@dryft.site",
		ProfilePhoto: &photoKey,
		BirthDate:    &birthDate,
		Location:     &models.Location{City: city},
		CreatedAt:    now,
	}

	svc := &Service{
		photoSigner: &mockPhotoSigner{
			getSignedURLFn: func(key string) (string, error) {
				if key != photoKey {
					t.Fatalf("unexpected key: %s", key)
				}
				return "https://cdn.dryft.site/signed.jpg", nil
			},
		},
	}

	resp := svc.userToProfileResponse(user)
	if resp.ProfilePhoto == nil || *resp.ProfilePhoto == "" {
		t.Fatal("expected signed profile photo URL")
	}
	if resp.Age == nil || *resp.Age <= 0 {
		t.Fatalf("expected computed age, got %+v", resp.Age)
	}
	if resp.City == nil || *resp.City != city {
		t.Fatalf("expected city %q, got %+v", city, resp.City)
	}
}

func TestCalculateAge(t *testing.T) {
	birthDate := time.Now().AddDate(-30, 0, 0)
	age := calculateAge(birthDate)
	if age < 29 || age > 30 {
		t.Fatalf("unexpected age result: %d", age)
	}
}
