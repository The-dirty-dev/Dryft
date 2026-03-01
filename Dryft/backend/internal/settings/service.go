package settings

import (
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"
)

// NotificationSettings represents notification preferences
type NotificationSettings struct {
	Enabled           bool   `json:"enabled"`
	Matches           bool   `json:"matches"`
	Messages          bool   `json:"messages"`
	Likes             bool   `json:"likes"`
	VRInvites         bool   `json:"vrInvites"`
	Marketing         bool   `json:"marketing"`
	Sound             bool   `json:"sound"`
	Vibration         bool   `json:"vibration"`
	QuietHoursEnabled bool   `json:"quietHoursEnabled"`
	QuietHoursStart   string `json:"quietHoursStart"`
	QuietHoursEnd     string `json:"quietHoursEnd"`
}

// PrivacySettings represents privacy preferences
type PrivacySettings struct {
	ShowOnlineStatus        bool `json:"showOnlineStatus"`
	ShowLastActive          bool `json:"showLastActive"`
	ShowDistance            bool `json:"showDistance"`
	ShowAge                 bool `json:"showAge"`
	ReadReceipts            bool `json:"readReceipts"`
	AllowScreenshots        bool `json:"allowScreenshots"`
	DiscoverableByNearby    bool `json:"discoverableByNearby"`
	ShareActivityWithMatches bool `json:"shareActivityWithMatches"`
}

// AppearanceSettings represents display preferences
type AppearanceSettings struct {
	Theme        string `json:"theme"`
	FontSize     string `json:"fontSize"`
	ReduceMotion bool   `json:"reduceMotion"`
	HighContrast bool   `json:"highContrast"`
}

// VRSettings represents VR experience preferences
type VRSettings struct {
	ComfortMode       string  `json:"comfortMode"`
	MovementType      string  `json:"movementType"`
	TurnType          string  `json:"turnType"`
	SnapTurnAngle     int     `json:"snapTurnAngle"`
	SmoothTurnSpeed   float64 `json:"smoothTurnSpeed"`
	Handedness        string  `json:"handedness"`
	ShowVignette      bool    `json:"showVignette"`
	HeightCalibration float64 `json:"heightCalibration"`
	VoiceChatVolume   int     `json:"voiceChatVolume"`
	MusicVolume       int     `json:"musicVolume"`
	SFXVolume         int     `json:"sfxVolume"`
	SpatialAudio      bool    `json:"spatialAudio"`
}

// HapticSettings represents haptic device preferences
type HapticSettings struct {
	Enabled            bool    `json:"enabled"`
	DeviceID           *string `json:"deviceId"`
	DeviceName         *string `json:"deviceName"`
	Intensity          int     `json:"intensity"`
	AllowRemoteControl bool    `json:"allowRemoteControl"`
	RequireConsent     bool    `json:"requireConsent"`
	AutoConnect        bool    `json:"autoConnect"`
}

// MatchingPreferences represents matching criteria
type MatchingPreferences struct {
	InterestedIn      string   `json:"interestedIn"`
	AgeRangeMin       int      `json:"ageRangeMin"`
	AgeRangeMax       int      `json:"ageRangeMax"`
	MaxDistance       int      `json:"maxDistance"`
	DistanceUnit      string   `json:"distanceUnit"`
	ShowVerifiedOnly  bool     `json:"showVerifiedOnly"`
	VRUsersOnly       bool     `json:"vrUsersOnly"`
	RelationshipTypes []string `json:"relationshipTypes"`
}

// SafetySettings represents safety preferences
type SafetySettings struct {
	PanicButtonEnabled     bool   `json:"panicButtonEnabled"`
	PanicButtonVibration   bool   `json:"panicButtonVibration"`
	AutoBlockOnReport      bool   `json:"autoBlockOnReport"`
	HideBlockedContent     bool   `json:"hideBlockedContent"`
	ContentFilterLevel     string `json:"contentFilterLevel"`
	RequireConsentForHaptics bool `json:"requireConsentForHaptics"`
	SafeWordEnabled        bool   `json:"safeWordEnabled"`
	SafeWord               string `json:"safeWord"`
}

// AllSettings combines all settings categories
type AllSettings struct {
	Notifications NotificationSettings `json:"notifications"`
	Privacy       PrivacySettings      `json:"privacy"`
	Appearance    AppearanceSettings   `json:"appearance"`
	VR            VRSettings           `json:"vr"`
	Haptic        HapticSettings       `json:"haptic"`
	Matching      MatchingPreferences  `json:"matching"`
	Safety        SafetySettings       `json:"safety"`
}

// UserSettings is the database model
type UserSettings struct {
	ID        uint            `gorm:"primaryKey"`
	UserID    string          `gorm:"uniqueIndex;not null"`
	Settings  json.RawMessage `gorm:"type:jsonb;not null"`
	Version   int             `gorm:"default:1"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

// SyncRequest represents a settings sync request
type SyncRequest struct {
	Settings        AllSettings `json:"settings"`
	ClientUpdatedAt *time.Time  `json:"clientUpdatedAt"`
}

// SyncResult represents the result of a sync operation
type SyncResult struct {
	Merged          AllSettings `json:"merged"`
	Conflicts       []string    `json:"conflicts"`
	ServerUpdatedAt time.Time   `json:"serverUpdatedAt"`
}

// Service handles settings operations
type Service struct {
	db *gorm.DB
}

// NewService creates a new settings service
func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

// AutoMigrate runs database migrations
func (s *Service) AutoMigrate() error {
	return s.db.AutoMigrate(&UserSettings{})
}

// GetSettings retrieves user settings
func (s *Service) GetSettings(userID string) (*AllSettings, error) {
	var userSettings UserSettings
	err := s.db.Where("user_id = ?", userID).First(&userSettings).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Return defaults for new users
		defaults := s.getDefaults()
		return &defaults, nil
	}

	if err != nil {
		return nil, err
	}

	var settings AllSettings
	if err := json.Unmarshal(userSettings.Settings, &settings); err != nil {
		return nil, err
	}

	return &settings, nil
}

// UpdateSettings updates all user settings
func (s *Service) UpdateSettings(userID string, settings AllSettings) error {
	settingsJSON, err := json.Marshal(settings)
	if err != nil {
		return err
	}

	result := s.db.Where("user_id = ?", userID).Assign(UserSettings{
		Settings:  settingsJSON,
		UpdatedAt: time.Now(),
	}).FirstOrCreate(&UserSettings{UserID: userID, Settings: settingsJSON})

	return result.Error
}

// UpdateCategory updates a specific settings category
func (s *Service) UpdateCategory(userID string, category string, data interface{}) error {
	settings, err := s.GetSettings(userID)
	if err != nil {
		return err
	}

	switch category {
	case "notifications":
		if v, ok := data.(NotificationSettings); ok {
			settings.Notifications = v
		}
	case "privacy":
		if v, ok := data.(PrivacySettings); ok {
			settings.Privacy = v
		}
	case "appearance":
		if v, ok := data.(AppearanceSettings); ok {
			settings.Appearance = v
		}
	case "vr":
		if v, ok := data.(VRSettings); ok {
			settings.VR = v
		}
	case "haptic":
		if v, ok := data.(HapticSettings); ok {
			settings.Haptic = v
		}
	case "matching":
		if v, ok := data.(MatchingPreferences); ok {
			settings.Matching = v
		}
	case "safety":
		if v, ok := data.(SafetySettings); ok {
			settings.Safety = v
		}
	default:
		return errors.New("unknown settings category")
	}

	return s.UpdateSettings(userID, *settings)
}

// SyncSettings handles bidirectional sync with conflict resolution
func (s *Service) SyncSettings(userID string, req SyncRequest) (*SyncResult, error) {
	var userSettings UserSettings
	err := s.db.Where("user_id = ?", userID).First(&userSettings).Error

	var serverSettings AllSettings
	var serverUpdatedAt time.Time

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// No server settings, use client settings
		serverSettings = s.getDefaults()
		serverUpdatedAt = time.Time{}
	} else if err != nil {
		return nil, err
	} else {
		if err := json.Unmarshal(userSettings.Settings, &serverSettings); err != nil {
			return nil, err
		}
		serverUpdatedAt = userSettings.UpdatedAt
	}

	// Merge settings
	merged, conflicts := s.mergeSettings(serverSettings, req.Settings, serverUpdatedAt, req.ClientUpdatedAt)

	// Save merged settings
	if err := s.UpdateSettings(userID, merged); err != nil {
		return nil, err
	}

	return &SyncResult{
		Merged:          merged,
		Conflicts:       conflicts,
		ServerUpdatedAt: time.Now(),
	}, nil
}

// mergeSettings merges server and client settings
func (s *Service) mergeSettings(server, client AllSettings, serverTime time.Time, clientTime *time.Time) (AllSettings, []string) {
	var conflicts []string
	merged := server

	// Simple last-write-wins strategy
	// In production, you might want more sophisticated conflict resolution
	if clientTime != nil && clientTime.After(serverTime) {
		merged = client
	} else if !serverTime.IsZero() {
		// Server is newer, check for specific conflicts
		if !settingsEqual(server.Notifications, client.Notifications) {
			conflicts = append(conflicts, "notifications")
		}
		if !settingsEqual(server.Privacy, client.Privacy) {
			conflicts = append(conflicts, "privacy")
		}
		if !settingsEqual(server.Matching, client.Matching) {
			conflicts = append(conflicts, "matching")
		}
	}

	return merged, conflicts
}

// settingsEqual compares two settings structs
func settingsEqual(a, b interface{}) bool {
	aJSON, _ := json.Marshal(a)
	bJSON, _ := json.Marshal(b)
	return string(aJSON) == string(bJSON)
}

// ResetSettings resets user settings to defaults
func (s *Service) ResetSettings(userID string) (*AllSettings, error) {
	defaults := s.getDefaults()
	if err := s.UpdateSettings(userID, defaults); err != nil {
		return nil, err
	}
	return &defaults, nil
}

// getDefaults returns default settings
func (s *Service) getDefaults() AllSettings {
	return AllSettings{
		Notifications: NotificationSettings{
			Enabled:           true,
			Matches:           true,
			Messages:          true,
			Likes:             true,
			VRInvites:         true,
			Marketing:         false,
			Sound:             true,
			Vibration:         true,
			QuietHoursEnabled: false,
			QuietHoursStart:   "22:00",
			QuietHoursEnd:     "08:00",
		},
		Privacy: PrivacySettings{
			ShowOnlineStatus:        true,
			ShowLastActive:          true,
			ShowDistance:            true,
			ShowAge:                 true,
			ReadReceipts:            true,
			AllowScreenshots:        false,
			DiscoverableByNearby:    true,
			ShareActivityWithMatches: false,
		},
		Appearance: AppearanceSettings{
			Theme:        "dark",
			FontSize:     "medium",
			ReduceMotion: false,
			HighContrast: false,
		},
		VR: VRSettings{
			ComfortMode:       "comfortable",
			MovementType:      "teleport",
			TurnType:          "snap",
			SnapTurnAngle:     45,
			SmoothTurnSpeed:   60,
			Handedness:        "right",
			ShowVignette:      true,
			HeightCalibration: 0,
			VoiceChatVolume:   80,
			MusicVolume:       50,
			SFXVolume:         70,
			SpatialAudio:      true,
		},
		Haptic: HapticSettings{
			Enabled:            false,
			DeviceID:           nil,
			DeviceName:         nil,
			Intensity:          50,
			AllowRemoteControl: false,
			RequireConsent:     true,
			AutoConnect:        false,
		},
		Matching: MatchingPreferences{
			InterestedIn:      "everyone",
			AgeRangeMin:       18,
			AgeRangeMax:       50,
			MaxDistance:       50,
			DistanceUnit:      "miles",
			ShowVerifiedOnly:  false,
			VRUsersOnly:       false,
			RelationshipTypes: []string{"dating"},
		},
		Safety: SafetySettings{
			PanicButtonEnabled:     true,
			PanicButtonVibration:   true,
			AutoBlockOnReport:      true,
			HideBlockedContent:     true,
			ContentFilterLevel:     "moderate",
			RequireConsentForHaptics: true,
			SafeWordEnabled:        false,
			SafeWord:               "",
		},
	}
}

// GetUpdatedAt returns the last update time for user settings
func (s *Service) GetUpdatedAt(userID string) (*time.Time, error) {
	var userSettings UserSettings
	err := s.db.Where("user_id = ?", userID).Select("updated_at").First(&userSettings).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &userSettings.UpdatedAt, nil
}
