package verification

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"
	"time"
)

type mockVerificationHandlerService struct {
	getUserVerificationsFn    func(ctx context.Context, userID string) ([]Verification, error)
	calculateTrustScoreFn     func(ctx context.Context, userID string) (int, error)
	isUserVerifiedFn          func(ctx context.Context, userID string) (bool, error)
	submitPhotoFn             func(ctx context.Context, userID string, photoData io.Reader, filename, poseType string) (*Verification, error)
	sendPhoneFn               func(ctx context.Context, userID, phoneNumber string) (*VerificationCode, error)
	verifyPhoneFn             func(ctx context.Context, userID, verificationID, code string) (*Verification, error)
	sendEmailFn               func(ctx context.Context, userID, email string) (*VerificationCode, error)
	verifyEmailFn             func(ctx context.Context, userID, token string) (*Verification, error)
	submitIDFn                func(ctx context.Context, userID string, frontData io.Reader, backData io.Reader) (*Verification, error)
	connectSocialFn           func(ctx context.Context, userID, provider, socialID, socialEmail string) (*Verification, error)
	getPendingVerificationsFn func(ctx context.Context, vType VerificationType, limit, offset int) ([]Verification, int64, error)
	reviewVerificationFn      func(ctx context.Context, verificationID, reviewerID string, approved bool, reason string) error
}

func (m *mockVerificationHandlerService) GetUserVerifications(ctx context.Context, userID string) ([]Verification, error) {
	return m.getUserVerificationsFn(ctx, userID)
}
func (m *mockVerificationHandlerService) CalculateTrustScore(ctx context.Context, userID string) (int, error) {
	return m.calculateTrustScoreFn(ctx, userID)
}
func (m *mockVerificationHandlerService) IsUserVerified(ctx context.Context, userID string) (bool, error) {
	return m.isUserVerifiedFn(ctx, userID)
}
func (m *mockVerificationHandlerService) SubmitPhotoVerification(ctx context.Context, userID string, photoData io.Reader, filename, poseType string) (*Verification, error) {
	return m.submitPhotoFn(ctx, userID, photoData, filename, poseType)
}
func (m *mockVerificationHandlerService) SendPhoneVerification(ctx context.Context, userID, phoneNumber string) (*VerificationCode, error) {
	if m.sendPhoneFn == nil {
		return &VerificationCode{}, nil
	}
	return m.sendPhoneFn(ctx, userID, phoneNumber)
}
func (m *mockVerificationHandlerService) VerifyPhoneCode(ctx context.Context, userID, verificationID, code string) (*Verification, error) {
	return m.verifyPhoneFn(ctx, userID, verificationID, code)
}
func (m *mockVerificationHandlerService) SendEmailVerification(ctx context.Context, userID, email string) (*VerificationCode, error) {
	if m.sendEmailFn == nil {
		return &VerificationCode{}, nil
	}
	return m.sendEmailFn(ctx, userID, email)
}
func (m *mockVerificationHandlerService) VerifyEmailCode(ctx context.Context, userID, token string) (*Verification, error) {
	if m.verifyEmailFn == nil {
		return &Verification{}, nil
	}
	return m.verifyEmailFn(ctx, userID, token)
}
func (m *mockVerificationHandlerService) SubmitIDVerification(ctx context.Context, userID string, frontData io.Reader, backData io.Reader) (*Verification, error) {
	if m.submitIDFn == nil {
		return &Verification{}, nil
	}
	return m.submitIDFn(ctx, userID, frontData, backData)
}
func (m *mockVerificationHandlerService) ConnectSocialAccount(ctx context.Context, userID, provider, socialID, socialEmail string) (*Verification, error) {
	if m.connectSocialFn == nil {
		return &Verification{}, nil
	}
	return m.connectSocialFn(ctx, userID, provider, socialID, socialEmail)
}
func (m *mockVerificationHandlerService) GetPendingVerifications(ctx context.Context, vType VerificationType, limit, offset int) ([]Verification, int64, error) {
	if m.getPendingVerificationsFn == nil {
		return []Verification{}, 0, nil
	}
	return m.getPendingVerificationsFn(ctx, vType, limit, offset)
}
func (m *mockVerificationHandlerService) ReviewVerification(ctx context.Context, verificationID, reviewerID string, approved bool, reason string) error {
	if m.reviewVerificationFn == nil {
		return nil
	}
	return m.reviewVerificationFn(ctx, verificationID, reviewerID, approved, reason)
}

type mockSocialValidator struct {
	validateFn func(ctx context.Context, provider, token string) (*SocialProfile, error)
}

func (m *mockSocialValidator) Validate(ctx context.Context, provider, token string) (*SocialProfile, error) {
	return m.validateFn(ctx, provider, token)
}

func TestGetVerificationStatus_Success(t *testing.T) {
	now := time.Now().UTC()
	h := &Handler{
		service: &mockVerificationHandlerService{
			getUserVerificationsFn: func(_ context.Context, userID string) ([]Verification, error) {
				if userID != "u-1" {
					t.Fatalf("unexpected userID: %s", userID)
				}
				return []Verification{{Type: TypePhone, Status: StatusApproved, SubmittedAt: now}}, nil
			},
			calculateTrustScoreFn: func(context.Context, string) (int, error) { return 88, nil },
			isUserVerifiedFn:      func(context.Context, string) (bool, error) { return true, nil },
		},
		socialValidator: &mockSocialValidator{validateFn: func(context.Context, string, string) (*SocialProfile, error) { return nil, nil }},
	}

	req := httptest.NewRequest(http.MethodGet, "/verification/status", nil)
	req = req.WithContext(context.WithValue(req.Context(), "user_id", "u-1"))
	rec := httptest.NewRecorder()
	h.GetVerificationStatus(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body VerificationStatusResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.TrustScore != 88 || !body.IsVerified {
		t.Fatalf("unexpected response: %+v", body)
	}
}

func TestSubmitPhotoVerification_AlreadyVerified(t *testing.T) {
	h := &Handler{
		service: &mockVerificationHandlerService{
			getUserVerificationsFn: func(context.Context, string) ([]Verification, error) { return nil, nil },
			calculateTrustScoreFn:  func(context.Context, string) (int, error) { return 0, nil },
			isUserVerifiedFn:       func(context.Context, string) (bool, error) { return false, nil },
			submitPhotoFn: func(context.Context, string, io.Reader, string, string) (*Verification, error) {
				return nil, ErrAlreadyVerified
			},
			verifyPhoneFn: func(context.Context, string, string, string) (*Verification, error) { return nil, nil },
		},
		socialValidator: &mockSocialValidator{validateFn: func(context.Context, string, string) (*SocialProfile, error) { return nil, nil }},
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	partHeader := textproto.MIMEHeader{
		"Content-Disposition": {`form-data; name="photo"; filename="photo.jpg"`},
		"Content-Type":        {"image/jpeg"},
	}
	part, err := writer.CreatePart(partHeader)
	if err != nil {
		t.Fatalf("create part: %v", err)
	}
	if _, err := part.Write([]byte("fake")); err != nil {
		t.Fatalf("write part: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/verification/photo", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req = req.WithContext(context.WithValue(req.Context(), "user_id", "u-1"))
	rec := httptest.NewRecorder()
	h.SubmitPhotoVerification(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", rec.Code)
	}
}

func TestVerifyPhoneCode_NotFound(t *testing.T) {
	h := &Handler{
		service: &mockVerificationHandlerService{
			getUserVerificationsFn: func(context.Context, string) ([]Verification, error) { return nil, nil },
			calculateTrustScoreFn:  func(context.Context, string) (int, error) { return 0, nil },
			isUserVerifiedFn:       func(context.Context, string) (bool, error) { return false, nil },
			verifyPhoneFn: func(context.Context, string, string, string) (*Verification, error) {
				return nil, ErrVerificationNotFound
			},
			submitPhotoFn: func(context.Context, string, io.Reader, string, string) (*Verification, error) { return nil, nil },
		},
		socialValidator: &mockSocialValidator{validateFn: func(context.Context, string, string) (*SocialProfile, error) { return nil, nil }},
	}

	req := httptest.NewRequest(http.MethodPost, "/verification/phone/verify", strings.NewReader(`{"verification_id":"v1","code":"123456"}`))
	req = req.WithContext(context.WithValue(req.Context(), "user_id", "u-1"))
	rec := httptest.NewRecorder()
	h.VerifyPhoneCode(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestConnectSocialAccount_UnsupportedProvider(t *testing.T) {
	h := &Handler{
		service: &mockVerificationHandlerService{
			getUserVerificationsFn: func(context.Context, string) ([]Verification, error) { return nil, nil },
			calculateTrustScoreFn:  func(context.Context, string) (int, error) { return 0, nil },
			isUserVerifiedFn:       func(context.Context, string) (bool, error) { return false, nil },
			verifyPhoneFn:          func(context.Context, string, string, string) (*Verification, error) { return nil, nil },
			submitPhotoFn:          func(context.Context, string, io.Reader, string, string) (*Verification, error) { return nil, nil },
		},
		socialValidator: &mockSocialValidator{
			validateFn: func(context.Context, string, string) (*SocialProfile, error) {
				return nil, ErrUnsupportedProvider
			},
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/verification/social", strings.NewReader(`{"provider":"unknown","token":"abc"}`))
	req = req.WithContext(context.WithValue(req.Context(), "user_id", "u-1"))
	rec := httptest.NewRecorder()
	h.ConnectSocialAccount(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}
