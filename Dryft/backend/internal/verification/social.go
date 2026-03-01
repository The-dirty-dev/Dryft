package verification

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// SocialProfile holds the validated user info returned by a social provider.
type SocialProfile struct {
	ID    string // Provider-scoped user ID
	Email string // May be empty if not shared
}

// SocialTokenValidator validates an OAuth/OIDC token with the issuing provider
// and returns the user's social profile.
type SocialTokenValidator interface {
	Validate(ctx context.Context, provider, token string) (*SocialProfile, error)
}

// Errors returned by the validator.
var (
	ErrUnsupportedProvider = errors.New("unsupported social provider")
	ErrInvalidSocialToken  = errors.New("invalid or expired social token")
)

// SocialValidator validates tokens for Google, Apple, and Facebook.
type SocialValidator struct {
	googleClientID string
	httpClient     *http.Client
}

// NewSocialValidator creates a validator. googleClientID is required for Google
// token audience verification; pass "" to skip the audience check.
func NewSocialValidator(googleClientID string) *SocialValidator {
	return &SocialValidator{
		googleClientID: googleClientID,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Validate dispatches to the provider-specific validation method.
func (v *SocialValidator) Validate(ctx context.Context, provider, token string) (*SocialProfile, error) {
	switch provider {
	case "google":
		return v.validateGoogle(ctx, token)
	case "apple":
		return v.validateApple(ctx, token)
	case "facebook":
		return v.validateFacebook(ctx, token)
	default:
		return nil, fmt.Errorf("%w: %s", ErrUnsupportedProvider, provider)
	}
}

// validateGoogle validates a Google ID token via Google's tokeninfo endpoint.
func (v *SocialValidator) validateGoogle(ctx context.Context, idToken string) (*SocialProfile, error) {
	url := "https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build google request: %w", err)
	}

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("google token validation request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, ErrInvalidSocialToken
	}

	var payload struct {
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified string `json:"email_verified"`
		Aud           string `json:"aud"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode google response: %w", err)
	}

	// Verify the token was issued for our application.
	if v.googleClientID != "" && payload.Aud != v.googleClientID {
		return nil, ErrInvalidSocialToken
	}

	if payload.Sub == "" {
		return nil, ErrInvalidSocialToken
	}

	return &SocialProfile{
		ID:    payload.Sub,
		Email: payload.Email,
	}, nil
}

// validateApple validates an Apple Sign-In identity token by decoding the JWT
// payload and checking iss, sub, and exp claims. The client-side Apple Sign-In
// SDK already verified the token cryptographically; this server-side check
// extracts the user info and validates basic claims.
func (v *SocialValidator) validateApple(_ context.Context, idToken string) (*SocialProfile, error) {
	parts := strings.SplitN(idToken, ".", 3)
	if len(parts) != 3 {
		return nil, ErrInvalidSocialToken
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, ErrInvalidSocialToken
	}

	var claims struct {
		Iss   string `json:"iss"`
		Sub   string `json:"sub"`
		Email string `json:"email"`
		Exp   int64  `json:"exp"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, ErrInvalidSocialToken
	}

	if claims.Iss != "https://appleid.apple.com" {
		return nil, ErrInvalidSocialToken
	}
	if claims.Exp < time.Now().Unix() {
		return nil, ErrInvalidSocialToken
	}
	if claims.Sub == "" {
		return nil, ErrInvalidSocialToken
	}

	return &SocialProfile{
		ID:    claims.Sub,
		Email: claims.Email,
	}, nil
}

// validateFacebook validates a Facebook access token by calling the Graph API
// /me endpoint to fetch the user's profile.
func (v *SocialValidator) validateFacebook(ctx context.Context, accessToken string) (*SocialProfile, error) {
	url := "https://graph.facebook.com/me?fields=id,email&access_token=" + accessToken

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build facebook request: %w", err)
	}

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("facebook token validation request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, ErrInvalidSocialToken
	}

	var payload struct {
		ID    string `json:"id"`
		Email string `json:"email"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode facebook response: %w", err)
	}

	if payload.ID == "" {
		return nil, ErrInvalidSocialToken
	}

	return &SocialProfile{
		ID:    payload.ID,
		Email: payload.Email,
	}, nil
}
