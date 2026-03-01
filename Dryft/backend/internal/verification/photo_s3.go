package verification

import (
	"context"
	"fmt"
	"io"

	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/storage"
)

// S3PhotoStore stores verification photos in S3.
type S3PhotoStore struct {
	client *storage.S3Client
}

// NewS3PhotoStore creates a photo store backed by S3.
func NewS3PhotoStore(client *storage.S3Client) *S3PhotoStore {
	return &S3PhotoStore{client: client}
}

func (s *S3PhotoStore) Upload(ctx context.Context, userID string, data io.Reader, filename string) (string, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return "", fmt.Errorf("invalid user ID: %w", err)
	}

	raw, err := io.ReadAll(data)
	if err != nil {
		return "", fmt.Errorf("read photo data: %w", err)
	}

	contentType := "image/jpeg" // default
	key, err := s.client.UploadVerificationPhoto(uid, filename, raw, contentType)
	if err != nil {
		return "", fmt.Errorf("upload verification photo: %w", err)
	}

	url, err := s.client.GetSignedURL(key)
	if err != nil {
		return key, nil // return the key even if signing fails
	}

	return url, nil
}

func (s *S3PhotoStore) Delete(ctx context.Context, url string) error {
	return s.client.DeleteObject(url)
}
