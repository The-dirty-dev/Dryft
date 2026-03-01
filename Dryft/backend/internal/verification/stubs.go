package verification

import (
	"context"
	"errors"
	"io"
	"log/slog"
)

// Errors returned by stub implementations.
var (
	ErrPhotoStoreNotConfigured = errors.New("photo store not configured")
	ErrSMSNotConfigured        = errors.New("SMS service not configured")
	ErrEmailNotConfigured      = errors.New("email service not configured")
)

// LogPhotoStore is a stub PhotoStore that logs calls and returns an error.
// Use this as a safe default when S3 or another store is not configured.
type LogPhotoStore struct{}

func (LogPhotoStore) Upload(_ context.Context, userID string, _ io.Reader, filename string) (string, error) {
	slog.Warn("photo upload attempted but store not configured", "user_id", userID, "filename", filename)
	return "", ErrPhotoStoreNotConfigured
}

func (LogPhotoStore) Delete(_ context.Context, url string) error {
	slog.Warn("photo delete attempted but store not configured", "url", url)
	return ErrPhotoStoreNotConfigured
}

// LogSMSService is a stub SMSService that logs the message instead of sending.
type LogSMSService struct{}

func (LogSMSService) Send(_ context.Context, phoneNumber, message string) error {
	slog.Warn("SMS send attempted but service not configured", "phone", phoneNumber, "message_len", len(message))
	return ErrSMSNotConfigured
}

// LogEmailService is a stub EmailService that logs instead of sending.
type LogEmailService struct{}

func (LogEmailService) SendVerificationEmail(_ context.Context, email, code string) error {
	slog.Warn("email send attempted but service not configured", "email", email)
	return ErrEmailNotConfigured
}
