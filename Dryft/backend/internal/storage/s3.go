package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"path"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/google/uuid"

	appconfig "github.com/dryft-app/backend/internal/config"
)

// S3Client handles S3 operations
type S3Client struct {
	client     *s3.Client
	presigner  *s3.PresignClient
	bucket     string
	urlExpiry  time.Duration
}

// NewS3Client creates a new S3 client
func NewS3Client(cfg *appconfig.Config) (*S3Client, error) {
	// Build AWS config
	awsCfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion(cfg.S3Region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.AWSAccessKeyID,
			cfg.AWSSecretAccessKey,
			"",
		)),
	)
	if err != nil {
		return nil, fmt.Errorf("load AWS config: %w", err)
	}

	// Create S3 client options
	opts := func(o *s3.Options) {
		if cfg.S3Endpoint != "" {
			o.BaseEndpoint = aws.String(cfg.S3Endpoint)
			o.UsePathStyle = true // Required for MinIO and other S3-compatible services
		}
	}

	client := s3.NewFromConfig(awsCfg, opts)
	presigner := s3.NewPresignClient(client)

	return &S3Client{
		client:    client,
		presigner: presigner,
		bucket:    cfg.S3Bucket,
		urlExpiry: 24 * time.Hour, // URLs valid for 24 hours
	}, nil
}

// UploadPhoto uploads a photo to S3 and returns the key
func (s *S3Client) UploadPhoto(userID uuid.UUID, data []byte, contentType string) (string, error) {
	// Generate unique key
	ext := getExtensionFromContentType(contentType)
	key := fmt.Sprintf("photos/%s/%s%s", userID.String(), uuid.New().String(), ext)

	// Upload to S3
	_, err := s.client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket:       aws.String(s.bucket),
		Key:          aws.String(key),
		Body:         bytes.NewReader(data),
		ContentType:  aws.String(contentType),
		CacheControl: aws.String("max-age=31536000"), // Cache for 1 year
	})

	if err != nil {
		return "", fmt.Errorf("upload to S3: %w", err)
	}

	return key, nil
}

// UploadProfilePhoto uploads a profile photo (main photo)
func (s *S3Client) UploadProfilePhoto(userID uuid.UUID, data []byte, contentType string) (string, error) {
	ext := getExtensionFromContentType(contentType)
	key := fmt.Sprintf("profiles/%s/main%s", userID.String(), ext)

	_, err := s.client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket:       aws.String(s.bucket),
		Key:          aws.String(key),
		Body:         bytes.NewReader(data),
		ContentType:  aws.String(contentType),
		CacheControl: aws.String("max-age=86400"), // Cache for 1 day (profile photos change more often)
	})

	if err != nil {
		return "", fmt.Errorf("upload profile photo: %w", err)
	}

	return key, nil
}

// UploadVerificationPhoto uploads a verification photo (ID, selfie)
func (s *S3Client) UploadVerificationPhoto(userID uuid.UUID, photoType string, data []byte, contentType string) (string, error) {
	ext := getExtensionFromContentType(contentType)
	key := fmt.Sprintf("verification/%s/%s-%s%s", userID.String(), photoType, uuid.New().String(), ext)

	// Verification photos should be encrypted at rest
	_, err := s.client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket:               aws.String(s.bucket),
		Key:                  aws.String(key),
		Body:                 bytes.NewReader(data),
		ContentType:          aws.String(contentType),
		ServerSideEncryption: "AES256",
	})

	if err != nil {
		return "", fmt.Errorf("upload verification photo: %w", err)
	}

	return key, nil
}

// UploadChatMedia uploads media for chat messages
func (s *S3Client) UploadChatMedia(matchID uuid.UUID, data []byte, contentType string) (string, error) {
	ext := getExtensionFromContentType(contentType)
	key := fmt.Sprintf("chat/%s/%s%s", matchID.String(), uuid.New().String(), ext)

	_, err := s.client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	})

	if err != nil {
		return "", fmt.Errorf("upload chat media: %w", err)
	}

	return key, nil
}

// UploadMarketplaceAsset uploads a marketplace item asset
func (s *S3Client) UploadMarketplaceAsset(creatorID uuid.UUID, assetType string, data []byte, contentType string) (string, error) {
	ext := getExtensionFromContentType(contentType)
	key := fmt.Sprintf("marketplace/%s/%s/%s%s", creatorID.String(), assetType, uuid.New().String(), ext)

	_, err := s.client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	})

	if err != nil {
		return "", fmt.Errorf("upload marketplace asset: %w", err)
	}

	return key, nil
}

// GetSignedURL generates a presigned URL for downloading
func (s *S3Client) GetSignedURL(key string) (string, error) {
	if key == "" {
		return "", nil
	}

	presignedReq, err := s.presigner.PresignGetObject(context.Background(), &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = s.urlExpiry
	})

	if err != nil {
		return "", fmt.Errorf("generate signed URL: %w", err)
	}

	return presignedReq.URL, nil
}

// GetSignedUploadURL generates a presigned URL for direct upload from client
func (s *S3Client) GetSignedUploadURL(key, contentType string) (string, error) {
	presignedReq, err := s.presigner.PresignPutObject(context.Background(), &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = 15 * time.Minute // Upload URLs valid for 15 minutes
	})

	if err != nil {
		return "", fmt.Errorf("generate signed upload URL: %w", err)
	}

	return presignedReq.URL, nil
}

// DeleteObject deletes an object from S3
func (s *S3Client) DeleteObject(key string) error {
	_, err := s.client.DeleteObject(context.Background(), &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})

	if err != nil {
		return fmt.Errorf("delete object: %w", err)
	}

	return nil
}

// DeleteObjects deletes multiple objects from S3
func (s *S3Client) DeleteObjects(keys []string) error {
	if len(keys) == 0 {
		return nil
	}

	// S3 batch delete is limited to 1000 objects
	for i := 0; i < len(keys); i += 1000 {
		end := i + 1000
		if end > len(keys) {
			end = len(keys)
		}

		batch := keys[i:end]
		objects := make([]types.ObjectIdentifier, len(batch))
		for j, key := range batch {
			objects[j] = types.ObjectIdentifier{Key: aws.String(key)}
		}

		_, err := s.client.DeleteObjects(context.Background(), &s3.DeleteObjectsInput{
			Bucket: aws.String(s.bucket),
			Delete: &types.Delete{Objects: objects},
		})

		if err != nil {
			return fmt.Errorf("delete objects batch: %w", err)
		}
	}

	return nil
}

// CopyObject copies an object within S3
func (s *S3Client) CopyObject(sourceKey, destKey string) error {
	_, err := s.client.CopyObject(context.Background(), &s3.CopyObjectInput{
		Bucket:     aws.String(s.bucket),
		CopySource: aws.String(path.Join(s.bucket, sourceKey)),
		Key:        aws.String(destKey),
	})

	if err != nil {
		return fmt.Errorf("copy object: %w", err)
	}

	return nil
}

// GetObject downloads an object from S3
func (s *S3Client) GetObject(key string) ([]byte, string, error) {
	result, err := s.client.GetObject(context.Background(), &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})

	if err != nil {
		return nil, "", fmt.Errorf("get object: %w", err)
	}
	defer result.Body.Close()

	data, err := io.ReadAll(result.Body)
	if err != nil {
		return nil, "", fmt.Errorf("read object body: %w", err)
	}

	contentType := ""
	if result.ContentType != nil {
		contentType = *result.ContentType
	}

	return data, contentType, nil
}

// ObjectExists checks if an object exists in S3
func (s *S3Client) ObjectExists(key string) (bool, error) {
	_, err := s.client.HeadObject(context.Background(), &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})

	if err != nil {
		// Check if it's a "not found" error
		if strings.Contains(err.Error(), "NotFound") || strings.Contains(err.Error(), "404") {
			return false, nil
		}
		return false, fmt.Errorf("head object: %w", err)
	}

	return true, nil
}

// Helper function to get file extension from content type
func getExtensionFromContentType(contentType string) string {
	switch contentType {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	case "video/mp4":
		return ".mp4"
	case "video/webm":
		return ".webm"
	case "audio/mpeg":
		return ".mp3"
	case "audio/wav":
		return ".wav"
	default:
		return ""
	}
}

