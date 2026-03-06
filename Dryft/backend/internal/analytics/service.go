package analytics

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

// Event represents a single analytics event
type Event struct {
	ID         uint            `gorm:"primaryKey"`
	UserID     *string         `gorm:"index"`
	SessionID  string          `gorm:"index;not null"`
	Name       string          `gorm:"index;not null"`
	Properties json.RawMessage `gorm:"type:jsonb"`
	Timestamp  time.Time       `gorm:"index;not null"`
	CreatedAt  time.Time
}

// EventBatch represents a batch of events from a client
type EventBatch struct {
	Events         []EventInput   `json:"events"`
	UserID         *string        `json:"userId"`
	UserProperties map[string]any `json:"userProperties"`
	SessionID      string         `json:"sessionId"`
	Timestamp      int64          `json:"timestamp"`
}

// EventInput represents an event from the client
type EventInput struct {
	Name       string         `json:"name"`
	Properties map[string]any `json:"properties"`
	Timestamp  int64          `json:"timestamp"`
	SessionID  string         `json:"sessionId"`
}

// UserAnalytics represents aggregated user analytics
type UserAnalytics struct {
	ID              uint   `gorm:"primaryKey"`
	UserID          string `gorm:"uniqueIndex;not null"`
	TotalSessions   int
	TotalEvents     int
	LastSeenAt      time.Time
	FirstSeenAt     time.Time
	TotalVRTime     int64 // seconds
	TotalMatches    int
	TotalMessages   int
	TotalPurchases  int
	PurchaseRevenue float64
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// DailyMetrics represents daily aggregated metrics
type DailyMetrics struct {
	ID             uint      `gorm:"primaryKey"`
	Date           time.Time `gorm:"uniqueIndex;not null"`
	ActiveUsers    int
	NewUsers       int
	Sessions       int
	TotalEvents    int
	Matches        int
	Messages       int
	VRSessions     int
	TotalVRMinutes int64
	Purchases      int
	Revenue        float64
	PanicButtons   int
	Reports        int
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// EventMetrics represents counts per event type
type EventMetrics struct {
	ID        uint      `gorm:"primaryKey"`
	Date      time.Time `gorm:"index;not null"`
	EventName string    `gorm:"index;not null"`
	Count     int
	CreatedAt time.Time
}

// Service handles analytics operations
type Service struct {
	db          *gorm.DB
	eventBuffer []Event
	bufferMutex sync.Mutex
	bufferSize  int
	flushTicker *time.Ticker
	stopChan    chan struct{}
}

var (
	ErrEventNameRequired = errors.New("event name is required")
	ErrEventTimeInvalid  = errors.New("event timestamp must be greater than zero")
	ErrSessionIDRequired = errors.New("event session_id is required")
	ErrBatchTooLarge     = errors.New("analytics event batch exceeds maximum size")
	ErrInvalidDateRange  = errors.New("start date must be before or equal to end date")
)

const maxBatchSize = 1000

// NewService creates a new analytics service
func NewService(db *gorm.DB) *Service {
	s := &Service{
		db:          db,
		eventBuffer: make([]Event, 0, 1000),
		bufferSize:  100,
		stopChan:    make(chan struct{}),
	}

	// Start background flush
	s.startBackgroundFlush()

	return s
}

// AutoMigrate runs database migrations
func (s *Service) AutoMigrate() error {
	return s.db.AutoMigrate(&Event{}, &UserAnalytics{}, &DailyMetrics{}, &EventMetrics{})
}

// IngestBatch processes a batch of events
func (s *Service) IngestBatch(batch EventBatch) error {
	if len(batch.Events) > maxBatchSize {
		return ErrBatchTooLarge
	}

	events := make([]Event, 0, len(batch.Events))

	for _, e := range batch.Events {
		name := strings.TrimSpace(e.Name)
		if name == "" {
			return ErrEventNameRequired
		}
		if e.Timestamp <= 0 {
			return ErrEventTimeInvalid
		}

		sessionID := strings.TrimSpace(e.SessionID)
		if sessionID == "" {
			sessionID = strings.TrimSpace(batch.SessionID)
		}
		if sessionID == "" {
			return ErrSessionIDRequired
		}

		props, _ := json.Marshal(e.Properties)

		event := Event{
			UserID:     batch.UserID,
			SessionID:  sessionID,
			Name:       name,
			Properties: props,
			Timestamp:  time.UnixMilli(e.Timestamp),
		}
		events = append(events, event)
	}

	s.bufferMutex.Lock()
	s.eventBuffer = append(s.eventBuffer, events...)
	shouldFlush := len(s.eventBuffer) >= s.bufferSize
	s.bufferMutex.Unlock()

	if shouldFlush {
		go s.flush()
	}

	// Update user analytics if user is identified
	if batch.UserID != nil {
		go s.updateUserAnalytics(*batch.UserID, events)
	}

	return nil
}

// flush writes buffered events to database
func (s *Service) flush() {
	s.bufferMutex.Lock()
	if len(s.eventBuffer) == 0 {
		s.bufferMutex.Unlock()
		return
	}

	events := s.eventBuffer
	s.eventBuffer = make([]Event, 0, 1000)
	s.bufferMutex.Unlock()

	// Batch insert
	if err := s.db.CreateInBatches(events, 100).Error; err != nil {
		// Log error but don't fail
		println("Failed to flush analytics events:", err.Error())
	}

	// Update event metrics
	s.updateEventMetrics(events)
}

// startBackgroundFlush starts periodic flushing
func (s *Service) startBackgroundFlush() {
	s.flushTicker = time.NewTicker(10 * time.Second)

	go func() {
		for {
			select {
			case <-s.flushTicker.C:
				s.flush()
			case <-s.stopChan:
				s.flushTicker.Stop()
				s.flush() // Final flush
				return
			}
		}
	}()
}

// Stop stops the analytics service
func (s *Service) Stop() {
	close(s.stopChan)
}

// updateUserAnalytics updates aggregated user stats
func (s *Service) updateUserAnalytics(userID string, events []Event) {
	var analytics UserAnalytics
	result := s.db.Where("user_id = ?", userID).First(&analytics)

	if result.Error == gorm.ErrRecordNotFound {
		analytics = UserAnalytics{
			UserID:      userID,
			FirstSeenAt: time.Now(),
		}
	}

	analytics.TotalEvents += len(events)
	analytics.TotalSessions++ // Simplified - should track unique sessions
	analytics.LastSeenAt = time.Now()

	// Count specific events
	for _, e := range events {
		switch e.Name {
		case "match_created":
			analytics.TotalMatches++
		case "message_sent":
			analytics.TotalMessages++
		case "purchase_completed":
			analytics.TotalPurchases++
			// Extract revenue from properties
			var props map[string]any
			if err := json.Unmarshal(e.Properties, &props); err == nil {
				if price, ok := props["price"].(float64); ok {
					analytics.PurchaseRevenue += price
				}
			}
		case "vr_session_ended":
			var props map[string]any
			if err := json.Unmarshal(e.Properties, &props); err == nil {
				if duration, ok := props["duration_seconds"].(float64); ok {
					analytics.TotalVRTime += int64(duration)
				}
			}
		}
	}

	s.db.Save(&analytics)
}

// updateEventMetrics updates daily event counts
func (s *Service) updateEventMetrics(events []Event) {
	today := time.Now().Truncate(24 * time.Hour)
	counts := make(map[string]int)

	for _, e := range events {
		counts[e.Name]++
	}

	for name, count := range counts {
		s.db.Exec(`
			INSERT INTO event_metrics (date, event_name, count, created_at)
			VALUES (?, ?, ?, ?)
			ON CONFLICT (date, event_name)
			DO UPDATE SET count = event_metrics.count + EXCLUDED.count
		`, today, name, count, time.Now())
	}
}

// Query methods

// GetUserAnalytics retrieves analytics for a user
func (s *Service) GetUserAnalytics(userID string) (*UserAnalytics, error) {
	if s.db == nil {
		return nil, fmt.Errorf("analytics database is not configured")
	}

	var analytics UserAnalytics
	err := s.db.Where("user_id = ?", userID).First(&analytics).Error
	if err != nil {
		return nil, err
	}
	return &analytics, nil
}

// GetDailyMetrics retrieves metrics for a date range
func (s *Service) GetDailyMetrics(startDate, endDate time.Time) ([]DailyMetrics, error) {
	if startDate.After(endDate) {
		return nil, ErrInvalidDateRange
	}
	if s.db == nil {
		return nil, fmt.Errorf("analytics database is not configured")
	}

	var metrics []DailyMetrics
	err := s.db.Where("date >= ? AND date <= ?", startDate, endDate).
		Order("date ASC").
		Find(&metrics).Error
	return metrics, err
}

// GetEventCounts retrieves event counts for a date range
func (s *Service) GetEventCounts(startDate, endDate time.Time, eventName string) ([]EventMetrics, error) {
	if startDate.After(endDate) {
		return nil, ErrInvalidDateRange
	}
	if s.db == nil {
		return nil, fmt.Errorf("analytics database is not configured")
	}

	query := s.db.Where("date >= ? AND date <= ?", startDate, endDate)
	if eventName != "" {
		query = query.Where("event_name = ?", eventName)
	}

	var metrics []EventMetrics
	err := query.Order("date ASC").Find(&metrics).Error
	return metrics, err
}

// GetRecentEvents retrieves recent events for a user
func (s *Service) GetRecentEvents(userID string, limit int) ([]Event, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 500 {
		limit = 500
	}
	if s.db == nil {
		return nil, fmt.Errorf("analytics database is not configured")
	}

	var events []Event
	err := s.db.Where("user_id = ?", userID).
		Order("timestamp DESC").
		Limit(limit).
		Find(&events).Error
	return events, err
}

// GetTopEvents retrieves most common events
func (s *Service) GetTopEvents(days int, limit int) ([]struct {
	Name  string
	Count int
}, error) {
	if days <= 0 {
		days = 1
	}
	if limit <= 0 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}
	if s.db == nil {
		return nil, fmt.Errorf("analytics database is not configured")
	}

	startDate := time.Now().AddDate(0, 0, -days)

	var results []struct {
		Name  string
		Count int
	}

	err := s.db.Model(&EventMetrics{}).
		Select("event_name as name, SUM(count) as count").
		Where("date >= ?", startDate).
		Group("event_name").
		Order("count DESC").
		Limit(limit).
		Find(&results).Error

	return results, err
}

// AggregateDailyMetrics calculates daily metrics (run as cron job)
func (s *Service) AggregateDailyMetrics(date time.Time) error {
	startOfDay := date.Truncate(24 * time.Hour)
	endOfDay := startOfDay.Add(24 * time.Hour)

	var metrics DailyMetrics
	metrics.Date = startOfDay

	// Count active users
	var activeUsers int64
	s.db.Model(&Event{}).
		Where("timestamp >= ? AND timestamp < ?", startOfDay, endOfDay).
		Distinct("user_id").
		Count(&activeUsers)
	metrics.ActiveUsers = int(activeUsers)

	// Count total events
	var totalEvents int64
	s.db.Model(&Event{}).
		Where("timestamp >= ? AND timestamp < ?", startOfDay, endOfDay).
		Count(&totalEvents)
	metrics.TotalEvents = int(totalEvents)

	// Count sessions
	var sessions int64
	s.db.Model(&Event{}).
		Where("timestamp >= ? AND timestamp < ?", startOfDay, endOfDay).
		Distinct("session_id").
		Count(&sessions)
	metrics.Sessions = int(sessions)

	// Count specific events
	eventNames := []struct {
		name  string
		field *int
	}{
		{"match_created", &metrics.Matches},
		{"message_sent", &metrics.Messages},
		{"vr_session_started", &metrics.VRSessions},
		{"purchase_completed", &metrics.Purchases},
		{"panic_button_pressed", &metrics.PanicButtons},
		{"user_reported", &metrics.Reports},
	}

	for _, ev := range eventNames {
		var cnt int64
		s.db.Model(&Event{}).
			Where("timestamp >= ? AND timestamp < ? AND name = ?", startOfDay, endOfDay, ev.name).
			Count(&cnt)
		*ev.field = int(cnt)
	}

	// Calculate revenue
	s.db.Model(&Event{}).
		Select("COALESCE(SUM((properties->>'price')::numeric), 0)").
		Where("timestamp >= ? AND timestamp < ? AND name = ?", startOfDay, endOfDay, "purchase_completed").
		Scan(&metrics.Revenue)

	// Save or update
	return s.db.Save(&metrics).Error
}
