package voice

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

var (
	ErrSessionNotFound    = errors.New("voice session not found")
	ErrAlreadyInSession   = errors.New("already in a voice session")
	ErrNotInSession       = errors.New("not in this voice session")
	ErrSessionFull        = errors.New("voice session is full")
	ErrUnauthorized       = errors.New("not authorized to join this session")
)

const (
	MaxParticipantsPerSession = 10
)

// Participant represents a user in a voice session
type Participant struct {
	UserID      uuid.UUID `json:"user_id"`
	DisplayName string    `json:"display_name"`
	IsSpeaking  bool      `json:"is_speaking"`
	IsMuted     bool      `json:"is_muted"`
	JoinedAt    time.Time `json:"joined_at"`
}

// VoiceSession represents an active voice chat session
type VoiceSession struct {
	SessionID    uuid.UUID              `json:"session_id"`
	Participants map[uuid.UUID]*Participant
	CreatedAt    time.Time              `json:"created_at"`
	mu           sync.RWMutex
}

// Service manages voice chat sessions
type Service struct {
	sessions map[uuid.UUID]*VoiceSession
	userToSession map[uuid.UUID]uuid.UUID // Maps user to their current session
	mu       sync.RWMutex
}

// NewService creates a new voice service
func NewService() *Service {
	return &Service{
		sessions:      make(map[uuid.UUID]*VoiceSession),
		userToSession: make(map[uuid.UUID]uuid.UUID),
	}
}

// CreateSession creates a new voice session
func (s *Service) CreateSession(ctx context.Context, sessionID uuid.UUID) (*VoiceSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if existing, ok := s.sessions[sessionID]; ok {
		return existing, nil
	}

	session := &VoiceSession{
		SessionID:    sessionID,
		Participants: make(map[uuid.UUID]*Participant),
		CreatedAt:    time.Now(),
	}

	s.sessions[sessionID] = session
	return session, nil
}

// GetSession gets a voice session by ID
func (s *Service) GetSession(ctx context.Context, sessionID uuid.UUID) (*VoiceSession, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	session, ok := s.sessions[sessionID]
	if !ok {
		return nil, ErrSessionNotFound
	}
	return session, nil
}

// JoinSession adds a user to a voice session
func (s *Service) JoinSession(ctx context.Context, sessionID, userID uuid.UUID, displayName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if user is already in a session
	if existingSessionID, ok := s.userToSession[userID]; ok {
		if existingSessionID == sessionID {
			return nil // Already in this session
		}
		// Leave the existing session first
		s.leaveSessionLocked(existingSessionID, userID)
	}

	// Get or create the session
	session, ok := s.sessions[sessionID]
	if !ok {
		session = &VoiceSession{
			SessionID:    sessionID,
			Participants: make(map[uuid.UUID]*Participant),
			CreatedAt:    time.Now(),
		}
		s.sessions[sessionID] = session
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	// Check if session is full
	if len(session.Participants) >= MaxParticipantsPerSession {
		return ErrSessionFull
	}

	// Add participant
	session.Participants[userID] = &Participant{
		UserID:      userID,
		DisplayName: displayName,
		IsSpeaking:  false,
		IsMuted:     false,
		JoinedAt:    time.Now(),
	}

	s.userToSession[userID] = sessionID
	return nil
}

// LeaveSession removes a user from a voice session
func (s *Service) LeaveSession(ctx context.Context, sessionID, userID uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.leaveSessionLocked(sessionID, userID)
}

func (s *Service) leaveSessionLocked(sessionID, userID uuid.UUID) error {
	session, ok := s.sessions[sessionID]
	if !ok {
		return ErrSessionNotFound
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	if _, ok := session.Participants[userID]; !ok {
		return ErrNotInSession
	}

	delete(session.Participants, userID)
	delete(s.userToSession, userID)

	// Clean up empty sessions
	if len(session.Participants) == 0 {
		delete(s.sessions, sessionID)
	}

	return nil
}

// GetParticipants gets all participants in a session
func (s *Service) GetParticipants(ctx context.Context, sessionID uuid.UUID) ([]Participant, error) {
	s.mu.RLock()
	session, ok := s.sessions[sessionID]
	s.mu.RUnlock()

	if !ok {
		return nil, ErrSessionNotFound
	}

	session.mu.RLock()
	defer session.mu.RUnlock()

	participants := make([]Participant, 0, len(session.Participants))
	for _, p := range session.Participants {
		participants = append(participants, *p)
	}
	return participants, nil
}

// SetSpeakingState updates a user's speaking state
func (s *Service) SetSpeakingState(ctx context.Context, sessionID, userID uuid.UUID, speaking bool) error {
	s.mu.RLock()
	session, ok := s.sessions[sessionID]
	s.mu.RUnlock()

	if !ok {
		return ErrSessionNotFound
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	participant, ok := session.Participants[userID]
	if !ok {
		return ErrNotInSession
	}

	participant.IsSpeaking = speaking
	return nil
}

// SetMutedState updates a user's muted state
func (s *Service) SetMutedState(ctx context.Context, sessionID, userID uuid.UUID, muted bool) error {
	s.mu.RLock()
	session, ok := s.sessions[sessionID]
	s.mu.RUnlock()

	if !ok {
		return ErrSessionNotFound
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	participant, ok := session.Participants[userID]
	if !ok {
		return ErrNotInSession
	}

	participant.IsMuted = muted
	if muted {
		participant.IsSpeaking = false
	}
	return nil
}

// IsUserInSession checks if a user is in a specific session
func (s *Service) IsUserInSession(ctx context.Context, sessionID, userID uuid.UUID) bool {
	s.mu.RLock()
	currentSessionID, ok := s.userToSession[userID]
	s.mu.RUnlock()

	return ok && currentSessionID == sessionID
}

// GetUserSession gets the session a user is currently in
func (s *Service) GetUserSession(ctx context.Context, userID uuid.UUID) (uuid.UUID, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	sessionID, ok := s.userToSession[userID]
	return sessionID, ok
}

// CleanupSession removes a session and all participants
func (s *Service) CleanupSession(ctx context.Context, sessionID uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	session, ok := s.sessions[sessionID]
	if !ok {
		return ErrSessionNotFound
	}

	session.mu.Lock()
	for userID := range session.Participants {
		delete(s.userToSession, userID)
	}
	session.mu.Unlock()

	delete(s.sessions, sessionID)
	return nil
}

// GetActiveSessions returns all active voice sessions
func (s *Service) GetActiveSessions(ctx context.Context) []VoiceSession {
	s.mu.RLock()
	defer s.mu.RUnlock()

	sessions := make([]VoiceSession, 0, len(s.sessions))
	for _, session := range s.sessions {
		session.mu.RLock()
		sessions = append(sessions, VoiceSession{
			SessionID:    session.SessionID,
			Participants: nil, // Don't include participants in list view
			CreatedAt:    session.CreatedAt,
		})
		session.mu.RUnlock()
	}
	return sessions
}
