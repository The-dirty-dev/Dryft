package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID  `json:"id"`
	Email        string     `json:"email"`
	PasswordHash string     `json:"-"` // Never expose password hash
	DisplayName  *string    `json:"display_name,omitempty"`
	Bio          *string    `json:"bio,omitempty"`
	ProfilePhoto *string    `json:"profile_photo,omitempty"` // S3 key

	// Extended profile fields
	BirthDate   *time.Time `json:"birth_date,omitempty"`
	Gender      *string    `json:"gender,omitempty"`      // male, female, non-binary, other
	LookingFor  []string   `json:"looking_for,omitempty"` // What genders they're interested in
	Interests   []string   `json:"interests,omitempty"`
	Photos      []string   `json:"photos,omitempty"` // S3 keys for additional photos
	Location    *Location  `json:"location,omitempty"`
	JobTitle    *string    `json:"job_title,omitempty"`
	Company     *string    `json:"company,omitempty"`
	School      *string    `json:"school,omitempty"`
	Height      *int       `json:"height,omitempty"` // In centimeters

	Verified   bool       `json:"verified"`
	VerifiedAt *time.Time `json:"verified_at,omitempty"`

	Preferences *UserPreferences `json:"preferences,omitempty"`

	DeletedAt *time.Time `json:"-"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// Location represents a user's location
type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	City      string  `json:"city,omitempty"`
	Country   string  `json:"country,omitempty"`
}

// UserPreferences represents dating/matching preferences
type UserPreferences struct {
	AgeMin          int  `json:"age_min"`
	AgeMax          int  `json:"age_max"`
	DistanceMax     int  `json:"distance_max"` // In kilometers
	ShowMe          bool `json:"show_me"`      // Whether to show in discover
	ShowDistance    bool `json:"show_distance"`
	ShowAge         bool `json:"show_age"`
	GlobalMode      bool `json:"global_mode"`       // Match anywhere vs local
	NotifyMatches   bool `json:"notify_matches"`    // Push notifications for matches
	NotifyMessages  bool `json:"notify_messages"`   // Push notifications for messages
	NotifyLikes     bool `json:"notify_likes"`      // Push notifications when someone likes you
}

// UserRegistration is the input for creating a new user
type UserRegistration struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
}

// UserPublicProfile is the public-facing user profile
type UserPublicProfile struct {
	ID           uuid.UUID `json:"id"`
	DisplayName  *string   `json:"display_name,omitempty"`
	Bio          *string   `json:"bio,omitempty"`
	ProfilePhoto *string   `json:"profile_photo_url,omitempty"` // Signed URL
	Verified     bool      `json:"verified"`
}

func (u *User) ToPublicProfile(photoURL string) UserPublicProfile {
	profile := UserPublicProfile{
		ID:          u.ID,
		DisplayName: u.DisplayName,
		Bio:         u.Bio,
		Verified:    u.Verified,
	}
	if photoURL != "" {
		profile.ProfilePhoto = &photoURL
	}
	return profile
}

// IsDeleted returns true if the user has been soft-deleted
func (u *User) IsDeleted() bool {
	return u.DeletedAt != nil
}

// CanStartVerification returns true if the user can begin age verification
func (u *User) CanStartVerification() bool {
	// Must have profile photo uploaded before verification
	return u.ProfilePhoto != nil && *u.ProfilePhoto != "" && !u.Verified
}
