package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestExtractBearerToken(t *testing.T) {
	tests := []struct {
		name     string
		header   string
		expected string
	}{
		{
			name:     "valid bearer token",
			header:   "Bearer eyJhbGciOiJIUzI1NiJ9.abc.def",
			expected: "eyJhbGciOiJIUzI1NiJ9.abc.def",
		},
		{
			name:     "valid bearer token lowercase",
			header:   "bearer my-token-value",
			expected: "my-token-value",
		},
		{
			name:     "valid bearer token mixed case",
			header:   "BEARER my-token-value",
			expected: "my-token-value",
		},
		{
			name:     "empty header",
			header:   "",
			expected: "",
		},
		{
			name:     "missing bearer prefix",
			header:   "my-token-value",
			expected: "",
		},
		{
			name:     "basic auth instead of bearer",
			header:   "Basic dXNlcjpwYXNz",
			expected: "",
		},
		{
			name:     "bearer with no token",
			header:   "Bearer",
			expected: "",
		},
		{
			name:     "bearer with extra parts",
			header:   "Bearer token extra-stuff",
			expected: "",
		},
		{
			name:     "only spaces",
			header:   "   ",
			expected: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			if tc.header != "" {
				req.Header.Set("Authorization", tc.header)
			}

			got := ExtractBearerToken(req)
			if got != tc.expected {
				t.Errorf("ExtractBearerToken() = %q, want %q", got, tc.expected)
			}
		})
	}
}

func TestWriteJSON(t *testing.T) {
	tests := []struct {
		name           string
		status         int
		data           interface{}
		expectedStatus int
	}{
		{
			name:           "200 with map payload",
			status:         http.StatusOK,
			data:           map[string]string{"message": "hello"},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "201 with struct payload",
			status:         http.StatusCreated,
			data:           struct{ Name string }{"Alice"},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "404 with error payload",
			status:         http.StatusNotFound,
			data:           map[string]string{"error": "not found"},
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rr := httptest.NewRecorder()
			writeJSON(rr, tc.status, tc.data)

			if rr.Code != tc.expectedStatus {
				t.Errorf("expected status %d, got %d", tc.expectedStatus, rr.Code)
			}

			contentType := rr.Header().Get("Content-Type")
			if contentType != "application/json" {
				t.Errorf("expected Content-Type %q, got %q", "application/json", contentType)
			}

			// Body should be valid JSON
			var decoded interface{}
			if err := json.NewDecoder(rr.Body).Decode(&decoded); err != nil {
				t.Errorf("response body is not valid JSON: %v", err)
			}
		})
	}
}

func TestWriteJSON_ContentMatchesPayload(t *testing.T) {
	rr := httptest.NewRecorder()
	payload := map[string]string{"key": "value", "foo": "bar"}
	writeJSON(rr, http.StatusOK, payload)

	var result map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode JSON response: %v", err)
	}

	if result["key"] != "value" {
		t.Errorf("expected key=%q, got %q", "value", result["key"])
	}
	if result["foo"] != "bar" {
		t.Errorf("expected foo=%q, got %q", "bar", result["foo"])
	}
}

func TestWriteError(t *testing.T) {
	tests := []struct {
		name           string
		status         int
		message        string
		expectedStatus int
	}{
		{
			name:           "bad request error",
			status:         http.StatusBadRequest,
			message:        "invalid input",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "unauthorized error",
			status:         http.StatusUnauthorized,
			message:        "authentication required",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "internal server error",
			status:         http.StatusInternalServerError,
			message:        "something went wrong",
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rr := httptest.NewRecorder()
			writeError(rr, tc.status, tc.message)

			if rr.Code != tc.expectedStatus {
				t.Errorf("expected status %d, got %d", tc.expectedStatus, rr.Code)
			}

			contentType := rr.Header().Get("Content-Type")
			if contentType != "application/json" {
				t.Errorf("expected Content-Type %q, got %q", "application/json", contentType)
			}

			var result map[string]string
			if err := json.NewDecoder(rr.Body).Decode(&result); err != nil {
				t.Fatalf("failed to decode error response: %v", err)
			}

			if result["error"] != tc.message {
				t.Errorf("expected error message %q, got %q", tc.message, result["error"])
			}
		})
	}
}

func TestWriteError_OnlyContainsErrorKey(t *testing.T) {
	rr := httptest.NewRecorder()
	writeError(rr, http.StatusBadRequest, "test error")

	var result map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	if len(result) != 1 {
		t.Errorf("expected exactly 1 key in error response, got %d keys: %v", len(result), result)
	}

	if _, ok := result["error"]; !ok {
		t.Error("expected 'error' key in response, not found")
	}
}
