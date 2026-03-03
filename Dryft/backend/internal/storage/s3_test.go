package storage

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/google/uuid"
)

type mockS3API struct {
	putObjectFn     func(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error)
	getObjectFn     func(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error)
	headObjectFn    func(ctx context.Context, params *s3.HeadObjectInput, optFns ...func(*s3.Options)) (*s3.HeadObjectOutput, error)
	deleteObjectFn  func(ctx context.Context, params *s3.DeleteObjectInput, optFns ...func(*s3.Options)) (*s3.DeleteObjectOutput, error)
	deleteObjectsFn func(ctx context.Context, params *s3.DeleteObjectsInput, optFns ...func(*s3.Options)) (*s3.DeleteObjectsOutput, error)
	copyObjectFn    func(ctx context.Context, params *s3.CopyObjectInput, optFns ...func(*s3.Options)) (*s3.CopyObjectOutput, error)
}

func (m *mockS3API) PutObject(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
	if m.putObjectFn == nil {
		return &s3.PutObjectOutput{}, nil
	}
	return m.putObjectFn(ctx, params, optFns...)
}

func (m *mockS3API) GetObject(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
	if m.getObjectFn == nil {
		return nil, errors.New("not implemented")
	}
	return m.getObjectFn(ctx, params, optFns...)
}

func (m *mockS3API) HeadObject(ctx context.Context, params *s3.HeadObjectInput, optFns ...func(*s3.Options)) (*s3.HeadObjectOutput, error) {
	if m.headObjectFn == nil {
		return &s3.HeadObjectOutput{}, nil
	}
	return m.headObjectFn(ctx, params, optFns...)
}

func (m *mockS3API) DeleteObject(ctx context.Context, params *s3.DeleteObjectInput, optFns ...func(*s3.Options)) (*s3.DeleteObjectOutput, error) {
	if m.deleteObjectFn == nil {
		return &s3.DeleteObjectOutput{}, nil
	}
	return m.deleteObjectFn(ctx, params, optFns...)
}

func (m *mockS3API) DeleteObjects(ctx context.Context, params *s3.DeleteObjectsInput, optFns ...func(*s3.Options)) (*s3.DeleteObjectsOutput, error) {
	if m.deleteObjectsFn == nil {
		return &s3.DeleteObjectsOutput{}, nil
	}
	return m.deleteObjectsFn(ctx, params, optFns...)
}

func (m *mockS3API) CopyObject(ctx context.Context, params *s3.CopyObjectInput, optFns ...func(*s3.Options)) (*s3.CopyObjectOutput, error) {
	if m.copyObjectFn == nil {
		return &s3.CopyObjectOutput{}, nil
	}
	return m.copyObjectFn(ctx, params, optFns...)
}

type mockS3Presigner struct {
	presignGetObjectFn func(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error)
	presignPutObjectFn func(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error)
}

func (m *mockS3Presigner) PresignGetObject(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error) {
	if m.presignGetObjectFn == nil {
		return &v4.PresignedHTTPRequest{URL: "https://example.com/get"}, nil
	}
	return m.presignGetObjectFn(ctx, params, optFns...)
}

func (m *mockS3Presigner) PresignPutObject(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error) {
	if m.presignPutObjectFn == nil {
		return &v4.PresignedHTTPRequest{URL: "https://example.com/put"}, nil
	}
	return m.presignPutObjectFn(ctx, params, optFns...)
}

func TestUploadPhoto_KeyAndContentType(t *testing.T) {
	userID := uuid.New()
	var gotKey, gotContentType string

	s3api := &mockS3API{
		putObjectFn: func(_ context.Context, params *s3.PutObjectInput, _ ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
			gotKey = aws.ToString(params.Key)
			gotContentType = aws.ToString(params.ContentType)
			return &s3.PutObjectOutput{}, nil
		},
	}
	client := NewS3ClientWithDeps(s3api, &mockS3Presigner{}, "dryft-bucket", 24*time.Hour)

	key, err := client.UploadPhoto(userID, []byte("abc"), "image/png")
	if err != nil {
		t.Fatalf("upload photo: %v", err)
	}

	if !strings.HasPrefix(key, "photos/"+userID.String()+"/") {
		t.Fatalf("unexpected key prefix: %s", key)
	}
	if !strings.HasSuffix(key, ".png") {
		t.Fatalf("expected .png key suffix, got %s", key)
	}
	if gotKey != key {
		t.Fatalf("expected uploaded key %s, got %s", key, gotKey)
	}
	if gotContentType != "image/png" {
		t.Fatalf("expected image/png, got %s", gotContentType)
	}
}

func TestUploadVerificationPhoto_UsesAES256(t *testing.T) {
	userID := uuid.New()
	var gotSSE types.ServerSideEncryption
	s3api := &mockS3API{
		putObjectFn: func(_ context.Context, params *s3.PutObjectInput, _ ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
			gotSSE = params.ServerSideEncryption
			return &s3.PutObjectOutput{}, nil
		},
	}
	client := NewS3ClientWithDeps(s3api, &mockS3Presigner{}, "dryft-bucket", 24*time.Hour)

	if _, err := client.UploadVerificationPhoto(userID, "selfie", []byte("abc"), "image/jpeg"); err != nil {
		t.Fatalf("upload verification photo: %v", err)
	}
	if gotSSE != types.ServerSideEncryptionAes256 {
		t.Fatalf("expected SSE AES256, got %s", gotSSE)
	}
}

func TestGetSignedURL_UsesConfiguredExpiry(t *testing.T) {
	var gotExpiry time.Duration
	presigner := &mockS3Presigner{
		presignGetObjectFn: func(_ context.Context, _ *s3.GetObjectInput, optFns ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error) {
			opts := &s3.PresignOptions{}
			for _, fn := range optFns {
				fn(opts)
			}
			gotExpiry = opts.Expires
			return &v4.PresignedHTTPRequest{URL: "https://example.com/get"}, nil
		},
	}

	client := NewS3ClientWithDeps(&mockS3API{}, presigner, "dryft-bucket", 24*time.Hour)
	url, err := client.GetSignedURL("photos/u/p.jpg")
	if err != nil {
		t.Fatalf("signed URL: %v", err)
	}
	if url == "" {
		t.Fatal("expected non-empty URL")
	}
	if gotExpiry != 24*time.Hour {
		t.Fatalf("expected expiry 24h, got %s", gotExpiry)
	}
}

func TestGetSignedUploadURL_Uses15MinuteExpiry(t *testing.T) {
	var gotExpiry time.Duration
	presigner := &mockS3Presigner{
		presignPutObjectFn: func(_ context.Context, _ *s3.PutObjectInput, optFns ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error) {
			opts := &s3.PresignOptions{}
			for _, fn := range optFns {
				fn(opts)
			}
			gotExpiry = opts.Expires
			return &v4.PresignedHTTPRequest{URL: "https://example.com/put"}, nil
		},
	}

	client := NewS3ClientWithDeps(&mockS3API{}, presigner, "dryft-bucket", 24*time.Hour)
	if _, err := client.GetSignedUploadURL("photos/u/p.jpg", "image/jpeg"); err != nil {
		t.Fatalf("signed upload URL: %v", err)
	}
	if gotExpiry != 15*time.Minute {
		t.Fatalf("expected expiry 15m, got %s", gotExpiry)
	}
}

func TestDeleteObjects_ChunksAt1000(t *testing.T) {
	keys := make([]string, 2001)
	for i := range keys {
		keys[i] = "k/" + uuid.NewString()
	}

	var batches []int
	s3api := &mockS3API{
		deleteObjectsFn: func(_ context.Context, params *s3.DeleteObjectsInput, _ ...func(*s3.Options)) (*s3.DeleteObjectsOutput, error) {
			batches = append(batches, len(params.Delete.Objects))
			return &s3.DeleteObjectsOutput{}, nil
		},
	}
	client := NewS3ClientWithDeps(s3api, &mockS3Presigner{}, "dryft-bucket", 24*time.Hour)

	if err := client.DeleteObjects(keys); err != nil {
		t.Fatalf("delete objects: %v", err)
	}
	if len(batches) != 3 {
		t.Fatalf("expected 3 batches, got %d", len(batches))
	}
	if batches[0] != 1000 || batches[1] != 1000 || batches[2] != 1 {
		t.Fatalf("unexpected batch sizes: %+v", batches)
	}
}

func TestObjectExists_TrueFalsePaths(t *testing.T) {
	clientExists := NewS3ClientWithDeps(&mockS3API{
		headObjectFn: func(_ context.Context, _ *s3.HeadObjectInput, _ ...func(*s3.Options)) (*s3.HeadObjectOutput, error) {
			return &s3.HeadObjectOutput{}, nil
		},
	}, &mockS3Presigner{}, "dryft-bucket", 24*time.Hour)

	ok, err := clientExists.ObjectExists("x")
	if err != nil || !ok {
		t.Fatalf("expected exists=true, got exists=%v err=%v", ok, err)
	}

	clientMissing := NewS3ClientWithDeps(&mockS3API{
		headObjectFn: func(_ context.Context, _ *s3.HeadObjectInput, _ ...func(*s3.Options)) (*s3.HeadObjectOutput, error) {
			return nil, errors.New("NotFound")
		},
	}, &mockS3Presigner{}, "dryft-bucket", 24*time.Hour)

	ok, err = clientMissing.ObjectExists("x")
	if err != nil {
		t.Fatalf("expected nil error for missing object, got %v", err)
	}
	if ok {
		t.Fatalf("expected exists=false for missing object")
	}
}

func TestGetObject_ReadsBodyAndContentType(t *testing.T) {
	s3api := &mockS3API{
		getObjectFn: func(_ context.Context, _ *s3.GetObjectInput, _ ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
			contentType := "image/png"
			return &s3.GetObjectOutput{
				Body:        io.NopCloser(bytes.NewBufferString("abc")),
				ContentType: &contentType,
			}, nil
		},
	}
	client := NewS3ClientWithDeps(s3api, &mockS3Presigner{}, "dryft-bucket", 24*time.Hour)
	data, ct, err := client.GetObject("k")
	if err != nil {
		t.Fatalf("get object: %v", err)
	}
	if string(data) != "abc" {
		t.Fatalf("expected object body abc, got %q", string(data))
	}
	if ct != "image/png" {
		t.Fatalf("expected image/png, got %s", ct)
	}
}

func TestGetExtensionFromContentType(t *testing.T) {
	tests := []struct {
		contentType string
		ext         string
	}{
		{"image/jpeg", ".jpg"},
		{"image/png", ".png"},
		{"image/webp", ".webp"},
		{"image/gif", ".gif"},
		{"video/mp4", ".mp4"},
		{"video/webm", ".webm"},
		{"audio/mpeg", ".mp3"},
		{"audio/wav", ".wav"},
		{"application/octet-stream", ""},
	}

	for _, tc := range tests {
		t.Run(tc.contentType, func(t *testing.T) {
			if got := getExtensionFromContentType(tc.contentType); got != tc.ext {
				t.Fatalf("expected %q, got %q", tc.ext, got)
			}
		})
	}
}

func TestGetSignedURL_EmptyKey(t *testing.T) {
	client := NewS3ClientWithDeps(&mockS3API{}, &mockS3Presigner{}, "dryft-bucket", 24*time.Hour)
	got, err := client.GetSignedURL("")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if got != "" {
		t.Fatalf("expected empty URL for empty key, got %q", got)
	}
}

func TestUploadPhoto_ContentTypePassthrough(t *testing.T) {
	userID := uuid.New()
	s3api := &mockS3API{
		putObjectFn: func(_ context.Context, params *s3.PutObjectInput, _ ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
			if aws.ToString(params.ContentType) != "image/webp" {
				return nil, errors.New("unexpected content type")
			}
			return &s3.PutObjectOutput{}, nil
		},
	}

	client := NewS3ClientWithDeps(s3api, &mockS3Presigner{}, "dryft-bucket", 24*time.Hour)
	if _, err := client.UploadPhoto(userID, []byte("x"), "image/webp"); err != nil {
		t.Fatalf("upload photo: %v", err)
	}
}

func TestDeleteObjects_EmptyKeysNoop(t *testing.T) {
	called := false
	s3api := &mockS3API{
		deleteObjectsFn: func(_ context.Context, _ *s3.DeleteObjectsInput, _ ...func(*s3.Options)) (*s3.DeleteObjectsOutput, error) {
			called = true
			return &s3.DeleteObjectsOutput{}, nil
		},
	}
	client := NewS3ClientWithDeps(s3api, &mockS3Presigner{}, "dryft-bucket", 24*time.Hour)
	if err := client.DeleteObjects(nil); err != nil {
		t.Fatalf("delete objects: %v", err)
	}
	if called {
		t.Fatal("expected no DeleteObjects call for empty key list")
	}
}

func TestPresignedURLsAreValidHTTP(t *testing.T) {
	client := NewS3ClientWithDeps(&mockS3API{}, &mockS3Presigner{}, "dryft-bucket", 24*time.Hour)
	getURL, err := client.GetSignedURL("photos/u/key.jpg")
	if err != nil {
		t.Fatalf("signed get URL: %v", err)
	}
	putURL, err := client.GetSignedUploadURL("photos/u/key.jpg", "image/jpeg")
	if err != nil {
		t.Fatalf("signed put URL: %v", err)
	}
	for _, u := range []string{getURL, putURL} {
		if !strings.HasPrefix(u, "http://") && !strings.HasPrefix(u, "https://") {
			t.Fatalf("expected HTTP URL, got %s", u)
		}
	}
}

func TestGetSignedUploadURL_SetsContentType(t *testing.T) {
	var gotContentType string
	presigner := &mockS3Presigner{
		presignPutObjectFn: func(_ context.Context, params *s3.PutObjectInput, _ ...func(*s3.PresignOptions)) (*v4.PresignedHTTPRequest, error) {
			gotContentType = aws.ToString(params.ContentType)
			return &v4.PresignedHTTPRequest{URL: "https://example.com/put"}, nil
		},
	}
	client := NewS3ClientWithDeps(&mockS3API{}, presigner, "dryft-bucket", 24*time.Hour)
	if _, err := client.GetSignedUploadURL("x", "image/png"); err != nil {
		t.Fatalf("signed upload URL: %v", err)
	}
	if gotContentType != "image/png" {
		t.Fatalf("expected image/png, got %s", gotContentType)
	}
}

func TestGetObjectErrorPath(t *testing.T) {
	s3api := &mockS3API{
		getObjectFn: func(_ context.Context, _ *s3.GetObjectInput, _ ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
			return nil, errors.New("boom")
		},
	}
	client := NewS3ClientWithDeps(s3api, &mockS3Presigner{}, "dryft-bucket", 24*time.Hour)
	if _, _, err := client.GetObject("k"); err == nil {
		t.Fatal("expected error")
	}
}

func TestObjectExists_HeadObjectError(t *testing.T) {
	s3api := &mockS3API{
		headObjectFn: func(_ context.Context, _ *s3.HeadObjectInput, _ ...func(*s3.Options)) (*s3.HeadObjectOutput, error) {
			return nil, errors.New("timeout")
		},
	}
	client := NewS3ClientWithDeps(s3api, &mockS3Presigner{}, "dryft-bucket", 24*time.Hour)
	if _, err := client.ObjectExists("k"); err == nil {
		t.Fatal("expected error")
	}
}

func TestCopyObject(t *testing.T) {
	var gotSource, gotDest string
	s3api := &mockS3API{
		copyObjectFn: func(_ context.Context, params *s3.CopyObjectInput, _ ...func(*s3.Options)) (*s3.CopyObjectOutput, error) {
			gotSource = aws.ToString(params.CopySource)
			gotDest = aws.ToString(params.Key)
			return &s3.CopyObjectOutput{}, nil
		},
	}
	client := NewS3ClientWithDeps(s3api, &mockS3Presigner{}, "dryft-bucket", 24*time.Hour)
	if err := client.CopyObject("a/source.jpg", "b/dest.jpg"); err != nil {
		t.Fatalf("copy object: %v", err)
	}
	if gotSource != "dryft-bucket/a/source.jpg" || gotDest != "b/dest.jpg" {
		t.Fatalf("unexpected copy args source=%s dest=%s", gotSource, gotDest)
	}
}

func TestDeleteObject(t *testing.T) {
	var gotKey string
	s3api := &mockS3API{
		deleteObjectFn: func(_ context.Context, params *s3.DeleteObjectInput, _ ...func(*s3.Options)) (*s3.DeleteObjectOutput, error) {
			gotKey = aws.ToString(params.Key)
			return &s3.DeleteObjectOutput{}, nil
		},
	}
	client := NewS3ClientWithDeps(s3api, &mockS3Presigner{}, "dryft-bucket", 24*time.Hour)
	if err := client.DeleteObject("k"); err != nil {
		t.Fatalf("delete object: %v", err)
	}
	if gotKey != "k" {
		t.Fatalf("expected key k, got %s", gotKey)
	}
}

func TestSignedURLsLookLikeURLs(t *testing.T) {
	client := NewS3ClientWithDeps(&mockS3API{}, &mockS3Presigner{}, "dryft-bucket", 24*time.Hour)
	u, _ := client.GetSignedURL("k")
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		t.Fatalf("parse URL: %v", err)
	}
	if req.URL.Scheme == "" || req.URL.Host == "" {
		t.Fatalf("invalid URL: %s", u)
	}
}
