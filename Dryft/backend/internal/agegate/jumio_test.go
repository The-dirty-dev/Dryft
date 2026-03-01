package agegate

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/dryft-app/backend/internal/config"
	"github.com/dryft-app/backend/internal/models"
)

func TestJumioClientInitiateVerification_Success(t *testing.T) {
	var gotAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")

		var req InitiateVerificationRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}

		if req.CallbackURL != "https://example.com/callback" {
			t.Fatalf("expected callback url, got %q", req.CallbackURL)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(InitiateVerificationResponse{
			TransactionReference: "tx-123",
			RedirectURL:          "https://jumio.example/redirect",
			Timestamp:            time.Now().Format(time.RFC3339),
		})
	}))
	defer server.Close()

	cfg := &config.Config{
		JumioBaseURL:   server.URL,
		JumioAPIToken:  "token",
		JumioAPISecret: "secret",
	}

	client := NewJumioClient(cfg)
	resp, err := client.InitiateVerification(context.Background(), "user-1", "https://example.com/callback")
	if err != nil {
		t.Fatalf("initiate verification: %v", err)
	}

	expectedAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte("token:secret"))
	if gotAuth != expectedAuth {
		t.Fatalf("expected auth %q, got %q", expectedAuth, gotAuth)
	}

	if resp.RedirectURL != "https://jumio.example/redirect" {
		t.Fatalf("unexpected redirect url: %q", resp.RedirectURL)
	}
}

func TestJumioClientInitiateVerification_ErrorStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "bad", http.StatusInternalServerError)
	}))
	defer server.Close()

	cfg := &config.Config{
		JumioBaseURL:   server.URL,
		JumioAPIToken:  "token",
		JumioAPISecret: "secret",
	}

	client := NewJumioClient(cfg)
	if _, err := client.InitiateVerification(context.Background(), "user-1", "https://example.com/callback"); err == nil {
		t.Fatalf("expected error from jumio api")
	}
}

func TestJumioClientValidateWebhookSignature(t *testing.T) {
	payload := []byte("payload")
	cfg := &config.Config{
		JumioWebhookSecret: "secret",
		Environment:        "production",
	}

	client := NewJumioClient(cfg)

	mac := hmac.New(sha256.New, []byte(cfg.JumioWebhookSecret))
	mac.Write(payload)
	signature := hex.EncodeToString(mac.Sum(nil))

	if !client.ValidateWebhookSignature(payload, signature) {
		t.Fatalf("expected signature to validate")
	}

	if client.ValidateWebhookSignature(payload, "bad") {
		t.Fatalf("expected invalid signature")
	}
}

func TestJumioClientParseWebhookPayload_InvalidJSON(t *testing.T) {
	cfg := &config.Config{}
	client := NewJumioClient(cfg)

	if _, err := client.ParseWebhookPayload([]byte("not-json")); err == nil {
		t.Fatalf("expected parse error")
	}
}

func TestJumioClientProcessWebhookResult(t *testing.T) {
	cfg := &config.Config{}
	client := NewJumioClient(cfg)

	payload := &models.JumioWebhookPayload{}
	payload.ScanReference = "scan-1"
	payload.VerificationStatus = "APPROVED_VERIFIED"
	payload.Document.Type = "PASSPORT"
	payload.Document.Country = "US"
	payload.Document.DOB = "2000-01-02"
	payload.Similarity = "MATCH"

	result, err := client.ProcessWebhookResult(payload)
	if err != nil {
		t.Fatalf("process webhook result: %v", err)
	}

	if result.Status != models.JumioStatusApproved {
		t.Fatalf("expected approved status, got %v", result.Status)
	}
	if result.FaceMatchScore != 1.0 {
		t.Fatalf("expected face match score 1.0, got %v", result.FaceMatchScore)
	}
	if !client.IsAdult(result.DOB) {
		t.Fatalf("expected adult from DOB")
	}
}
