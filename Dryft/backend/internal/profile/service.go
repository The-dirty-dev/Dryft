package profile

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/dryft-app/backend/internal/database"
	"github.com/dryft-app/backend/internal/models"
)

var (
	ErrUserNotFound    = errors.New("user not found")
	ErrInvalidAge      = errors.New("invalid age range")
	ErrTooManyPhotos   = errors.New("maximum 6 photos allowed")
	ErrInvalidInterest = errors.New("interest too long")
)

// PhotoSigner generates signed URLs for S3 object keys.
type PhotoSigner interface {
	GetSignedURL(key string) (string, error)
}

// Service handles profile management
type Service struct {
	db          *database.DB
	photoSigner PhotoSigner
}

// NewService creates a new profile service
func NewService(db *database.DB) *Service {
	return &Service{db: db}
}

// SetPhotoSigner sets the photo signing service for generating signed URLs.
func (s *Service) SetPhotoSigner(signer PhotoSigner) {
	s.photoSigner = signer
}

// ProfileResponse is the full profile response
type ProfileResponse struct {
	ID           string   `json:"id"`
	Email        string   `json:"email"`
	DisplayName  *string  `json:"display_name,omitempty"`
	Bio          *string  `json:"bio,omitempty"`
	ProfilePhoto *string  `json:"profile_photo_url,omitempty"`
	Photos       []string `json:"photos,omitempty"`
	BirthDate    *string  `json:"birth_date,omitempty"`
	Age          *int     `json:"age,omitempty"`
	Gender       *string  `json:"gender,omitempty"`
	LookingFor   []string `json:"looking_for,omitempty"`
	Interests    []string `json:"interests,omitempty"`
	JobTitle     *string  `json:"job_title,omitempty"`
	Company      *string  `json:"company,omitempty"`
	School       *string  `json:"school,omitempty"`
	Height       *int     `json:"height,omitempty"`
	City         *string  `json:"city,omitempty"`
	Verified     bool     `json:"verified"`
	CreatedAt    string   `json:"created_at"`
}

// UpdateProfileRequest contains fields to update
type UpdateProfileRequest struct {
	DisplayName *string  `json:"display_name,omitempty"`
	Bio         *string  `json:"bio,omitempty"`
	BirthDate   *string  `json:"birth_date,omitempty"` // YYYY-MM-DD format
	Gender      *string  `json:"gender,omitempty"`
	LookingFor  []string `json:"looking_for,omitempty"`
	Interests   []string `json:"interests,omitempty"`
	JobTitle    *string  `json:"job_title,omitempty"`
	Company     *string  `json:"company,omitempty"`
	School      *string  `json:"school,omitempty"`
	Height      *int     `json:"height,omitempty"`
}

// UpdateLocationRequest updates user location
type UpdateLocationRequest struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	City      string  `json:"city,omitempty"`
	Country   string  `json:"country,omitempty"`
}

// UpdatePreferencesRequest updates dating preferences
type UpdatePreferencesRequest struct {
	AgeMin         *int  `json:"age_min,omitempty"`
	AgeMax         *int  `json:"age_max,omitempty"`
	DistanceMax    *int  `json:"distance_max,omitempty"`
	ShowMe         *bool `json:"show_me,omitempty"`
	ShowDistance   *bool `json:"show_distance,omitempty"`
	ShowAge        *bool `json:"show_age,omitempty"`
	GlobalMode     *bool `json:"global_mode,omitempty"`
	NotifyMatches  *bool `json:"notify_matches,omitempty"`
	NotifyMessages *bool `json:"notify_messages,omitempty"`
	NotifyLikes    *bool `json:"notify_likes,omitempty"`
}

// GetProfile returns the full user profile
func (s *Service) GetProfile(ctx context.Context, userID uuid.UUID) (*ProfileResponse, error) {
	var user models.User
	var preferencesJSON, locationJSON, interestsJSON, lookingForJSON, photosJSON []byte

	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, email, display_name, bio, profile_photo,
		       birth_date, gender, looking_for, interests, photos,
		       location, job_title, company, school, height,
		       verified, preferences, created_at
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
	`, userID).Scan(
		&user.ID, &user.Email, &user.DisplayName, &user.Bio, &user.ProfilePhoto,
		&user.BirthDate, &user.Gender, &lookingForJSON, &interestsJSON, &photosJSON,
		&locationJSON, &user.JobTitle, &user.Company, &user.School, &user.Height,
		&user.Verified, &preferencesJSON, &user.CreatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get profile: %w", err)
	}

	// Parse JSON fields
	if len(interestsJSON) > 0 {
		json.Unmarshal(interestsJSON, &user.Interests)
	}
	if len(lookingForJSON) > 0 {
		json.Unmarshal(lookingForJSON, &user.LookingFor)
	}
	if len(photosJSON) > 0 {
		json.Unmarshal(photosJSON, &user.Photos)
	}
	if len(locationJSON) > 0 {
		user.Location = &models.Location{}
		json.Unmarshal(locationJSON, user.Location)
	}

	return s.userToProfileResponse(&user), nil
}

// UpdateProfile updates user profile fields
func (s *Service) UpdateProfile(ctx context.Context, userID uuid.UUID, req *UpdateProfileRequest) (*ProfileResponse, error) {
	// Validate interests length
	for _, interest := range req.Interests {
		if len(interest) > 50 {
			return nil, ErrInvalidInterest
		}
	}

	// Parse birth date if provided
	var birthDate *time.Time
	if req.BirthDate != nil && *req.BirthDate != "" {
		parsed, err := time.Parse("2006-01-02", *req.BirthDate)
		if err != nil {
			return nil, fmt.Errorf("invalid birth date format: %w", err)
		}
		birthDate = &parsed
	}

	// Build dynamic update query
	interestsJSON, _ := json.Marshal(req.Interests)
	lookingForJSON, _ := json.Marshal(req.LookingFor)

	var user models.User
	var preferencesJSON, locationJSON, interestsOut, lookingForOut, photosJSON []byte

	err := s.db.Pool.QueryRow(ctx, `
		UPDATE users
		SET display_name = COALESCE($2, display_name),
		    bio = COALESCE($3, bio),
		    birth_date = COALESCE($4, birth_date),
		    gender = COALESCE($5, gender),
		    looking_for = COALESCE($6, looking_for),
		    interests = COALESCE($7, interests),
		    job_title = COALESCE($8, job_title),
		    company = COALESCE($9, company),
		    school = COALESCE($10, school),
		    height = COALESCE($11, height),
		    updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
		RETURNING id, email, display_name, bio, profile_photo,
		          birth_date, gender, looking_for, interests, photos,
		          location, job_title, company, school, height,
		          verified, preferences, created_at
	`, userID, req.DisplayName, req.Bio, birthDate, req.Gender,
		lookingForJSON, interestsJSON, req.JobTitle, req.Company, req.School, req.Height,
	).Scan(
		&user.ID, &user.Email, &user.DisplayName, &user.Bio, &user.ProfilePhoto,
		&user.BirthDate, &user.Gender, &lookingForOut, &interestsOut, &photosJSON,
		&locationJSON, &user.JobTitle, &user.Company, &user.School, &user.Height,
		&user.Verified, &preferencesJSON, &user.CreatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("update profile: %w", err)
	}

	// Parse JSON fields
	if len(interestsOut) > 0 {
		json.Unmarshal(interestsOut, &user.Interests)
	}
	if len(lookingForOut) > 0 {
		json.Unmarshal(lookingForOut, &user.LookingFor)
	}
	if len(photosJSON) > 0 {
		json.Unmarshal(photosJSON, &user.Photos)
	}
	if len(locationJSON) > 0 {
		user.Location = &models.Location{}
		json.Unmarshal(locationJSON, user.Location)
	}

	return s.userToProfileResponse(&user), nil
}

// UpdateLocation updates user location
func (s *Service) UpdateLocation(ctx context.Context, userID uuid.UUID, req *UpdateLocationRequest) error {
	location := models.Location{
		Latitude:  req.Latitude,
		Longitude: req.Longitude,
		City:      req.City,
		Country:   req.Country,
	}
	locationJSON, _ := json.Marshal(location)

	_, err := s.db.Pool.Exec(ctx, `
		UPDATE users
		SET location = $2, updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`, userID, locationJSON)

	if err != nil {
		return fmt.Errorf("update location: %w", err)
	}
	return nil
}

// GetPreferences returns user dating preferences
func (s *Service) GetPreferences(ctx context.Context, userID uuid.UUID) (*models.UserPreferences, error) {
	var preferencesJSON []byte

	err := s.db.Pool.QueryRow(ctx, `
		SELECT COALESCE(preferences, '{}')
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
	`, userID).Scan(&preferencesJSON)

	if err == pgx.ErrNoRows {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get preferences: %w", err)
	}

	prefs := &models.UserPreferences{
		AgeMin:         18,
		AgeMax:         99,
		DistanceMax:    100,
		ShowMe:         true,
		ShowDistance:   true,
		ShowAge:        true,
		NotifyMatches:  true,
		NotifyMessages: true,
		NotifyLikes:    true,
	}

	if len(preferencesJSON) > 0 {
		json.Unmarshal(preferencesJSON, prefs)
	}

	return prefs, nil
}

// UpdatePreferences updates user dating preferences
func (s *Service) UpdatePreferences(ctx context.Context, userID uuid.UUID, req *UpdatePreferencesRequest) (*models.UserPreferences, error) {
	// Get existing preferences
	prefs, err := s.GetPreferences(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Apply updates
	if req.AgeMin != nil {
		if *req.AgeMin < 18 {
			return nil, ErrInvalidAge
		}
		prefs.AgeMin = *req.AgeMin
	}
	if req.AgeMax != nil {
		prefs.AgeMax = *req.AgeMax
	}
	if prefs.AgeMin > prefs.AgeMax {
		return nil, ErrInvalidAge
	}
	if req.DistanceMax != nil {
		prefs.DistanceMax = *req.DistanceMax
	}
	if req.ShowMe != nil {
		prefs.ShowMe = *req.ShowMe
	}
	if req.ShowDistance != nil {
		prefs.ShowDistance = *req.ShowDistance
	}
	if req.ShowAge != nil {
		prefs.ShowAge = *req.ShowAge
	}
	if req.GlobalMode != nil {
		prefs.GlobalMode = *req.GlobalMode
	}
	if req.NotifyMatches != nil {
		prefs.NotifyMatches = *req.NotifyMatches
	}
	if req.NotifyMessages != nil {
		prefs.NotifyMessages = *req.NotifyMessages
	}
	if req.NotifyLikes != nil {
		prefs.NotifyLikes = *req.NotifyLikes
	}

	// Save
	prefsJSON, _ := json.Marshal(prefs)
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE users
		SET preferences = $2, updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`, userID, prefsJSON)

	if err != nil {
		return nil, fmt.Errorf("update preferences: %w", err)
	}

	return prefs, nil
}

// AddPhoto adds a photo to the user's gallery
func (s *Service) AddPhoto(ctx context.Context, userID uuid.UUID, photoKey string) ([]string, error) {
	// Get current photos
	var photosJSON []byte
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COALESCE(photos, '[]')
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
	`, userID).Scan(&photosJSON)

	if err == pgx.ErrNoRows {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get photos: %w", err)
	}

	var photos []string
	json.Unmarshal(photosJSON, &photos)

	// Check limit
	if len(photos) >= 6 {
		return nil, ErrTooManyPhotos
	}

	// Add new photo
	photos = append(photos, photoKey)
	photosJSON, _ = json.Marshal(photos)

	_, err = s.db.Pool.Exec(ctx, `
		UPDATE users
		SET photos = $2, updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`, userID, photosJSON)

	if err != nil {
		return nil, fmt.Errorf("add photo: %w", err)
	}

	return photos, nil
}

// RemovePhoto removes a photo from the user's gallery
func (s *Service) RemovePhoto(ctx context.Context, userID uuid.UUID, photoIndex int) ([]string, error) {
	// Get current photos
	var photosJSON []byte
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COALESCE(photos, '[]')
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
	`, userID).Scan(&photosJSON)

	if err == pgx.ErrNoRows {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get photos: %w", err)
	}

	var photos []string
	json.Unmarshal(photosJSON, &photos)

	// Check index
	if photoIndex < 0 || photoIndex >= len(photos) {
		return nil, errors.New("invalid photo index")
	}

	// Remove photo
	photos = append(photos[:photoIndex], photos[photoIndex+1:]...)
	photosJSON, _ = json.Marshal(photos)

	_, err = s.db.Pool.Exec(ctx, `
		UPDATE users
		SET photos = $2, updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`, userID, photosJSON)

	if err != nil {
		return nil, fmt.Errorf("remove photo: %w", err)
	}

	return photos, nil
}

// SetProfilePhoto sets the main profile photo
func (s *Service) SetProfilePhoto(ctx context.Context, userID uuid.UUID, photoKey string) error {
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE users
		SET profile_photo = $2, updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`, userID, photoKey)

	if err != nil {
		return fmt.Errorf("set profile photo: %w", err)
	}
	return nil
}

// ReorderPhotos reorders the user's gallery photos
func (s *Service) ReorderPhotos(ctx context.Context, userID uuid.UUID, newOrder []int) ([]string, error) {
	// Get current photos
	var photosJSON []byte
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COALESCE(photos, '[]')
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
	`, userID).Scan(&photosJSON)

	if err == pgx.ErrNoRows {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get photos: %w", err)
	}

	var photos []string
	json.Unmarshal(photosJSON, &photos)

	// Validate new order
	if len(newOrder) != len(photos) {
		return nil, errors.New("invalid reorder: length mismatch")
	}

	// Create reordered slice
	reordered := make([]string, len(photos))
	seen := make(map[int]bool)
	for i, idx := range newOrder {
		if idx < 0 || idx >= len(photos) || seen[idx] {
			return nil, errors.New("invalid reorder: invalid indices")
		}
		seen[idx] = true
		reordered[i] = photos[idx]
	}

	// Save
	photosJSON, _ = json.Marshal(reordered)
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE users
		SET photos = $2, updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`, userID, photosJSON)

	if err != nil {
		return nil, fmt.Errorf("reorder photos: %w", err)
	}

	return reordered, nil
}

// Helper to convert user to profile response
func (s *Service) userToProfileResponse(user *models.User) *ProfileResponse {
	resp := &ProfileResponse{
		ID:          user.ID.String(),
		Email:       user.Email,
		DisplayName: user.DisplayName,
		Bio:         user.Bio,
		Gender:      user.Gender,
		LookingFor:  user.LookingFor,
		Interests:   user.Interests,
		Photos:      user.Photos,
		JobTitle:    user.JobTitle,
		Company:     user.Company,
		School:      user.School,
		Height:      user.Height,
		Verified:    user.Verified,
		CreatedAt:   user.CreatedAt.Format(time.RFC3339),
	}

	if user.ProfilePhoto != nil && *user.ProfilePhoto != "" {
		if s.photoSigner != nil {
			if signedURL, err := s.photoSigner.GetSignedURL(*user.ProfilePhoto); err == nil && signedURL != "" {
				resp.ProfilePhoto = &signedURL
			} else {
				resp.ProfilePhoto = user.ProfilePhoto
			}
		} else {
			resp.ProfilePhoto = user.ProfilePhoto
		}
	}

	if user.BirthDate != nil {
		dateStr := user.BirthDate.Format("2006-01-02")
		resp.BirthDate = &dateStr
		age := calculateAge(*user.BirthDate)
		resp.Age = &age
	}

	if user.Location != nil && user.Location.City != "" {
		resp.City = &user.Location.City
	}

	return resp
}

// calculateAge calculates age from birth date
func calculateAge(birthDate time.Time) int {
	now := time.Now()
	age := now.Year() - birthDate.Year()
	if now.YearDay() < birthDate.YearDay() {
		age--
	}
	return age
}
