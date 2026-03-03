// Package httputil provides shared helpers for HTTP handlers: JSON
// encoding/decoding, pagination parsing, UUID extraction, and standard error
// responses. It replaces the duplicated helper functions found across handler
// packages.
package httputil

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// WriteJSON writes data as a JSON response with the given HTTP status code.
func WriteJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data) //nolint:errcheck
}

// RespondJSON is the preferred response helper for handlers.
// It aliases WriteJSON to preserve backward compatibility.
func RespondJSON(w http.ResponseWriter, status int, data any) {
	WriteJSON(w, status, data)
}

// ErrorResponse represents a structured API error with code for client-side i18n.
type ErrorResponse struct {
	Error   string `json:"error"`             // Human-readable message (English)
	Code    string `json:"code,omitempty"`    // Machine-readable code for i18n lookup
	Details any    `json:"details,omitempty"` // Optional additional details
}

// WriteError writes a JSON error response: {"error":"message"}.
func WriteError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, ErrorResponse{Error: message})
}

// RespondError is the preferred error helper for handlers.
// It guarantees {"error":"message"} response shape.
func RespondError(w http.ResponseWriter, status int, message string) {
	WriteError(w, status, message)
}

// WriteErrorWithCode writes a JSON error response with an error code for i18n:
// {"error":"message","code":"ERROR_CODE"}
// Clients can use the code to look up localized messages.
func WriteErrorWithCode(w http.ResponseWriter, status int, code, message string) {
	WriteJSON(w, status, ErrorResponse{Error: message, Code: code})
}

// Common error codes for client-side i18n mapping.
// Clients should map these codes to localized strings.
const (
	// Authentication errors
	ErrCodeUnauthorized       = "AUTH_UNAUTHORIZED"
	ErrCodeTokenExpired       = "AUTH_TOKEN_EXPIRED"
	ErrCodeInvalidCredentials = "AUTH_INVALID_CREDENTIALS"

	// Validation errors
	ErrCodeInvalidInput    = "VALIDATION_INVALID_INPUT"
	ErrCodeMissingField    = "VALIDATION_MISSING_FIELD"
	ErrCodeInvalidEmail    = "VALIDATION_INVALID_EMAIL"
	ErrCodeInvalidPassword = "VALIDATION_INVALID_PASSWORD"

	// Resource errors
	ErrCodeNotFound      = "RESOURCE_NOT_FOUND"
	ErrCodeAlreadyExists = "RESOURCE_ALREADY_EXISTS"
	ErrCodeConflict      = "RESOURCE_CONFLICT"

	// Rate limiting
	ErrCodeRateLimited = "RATE_LIMITED"

	// Verification errors
	ErrCodeNotVerified         = "VERIFICATION_REQUIRED"
	ErrCodeVerificationPending = "VERIFICATION_PENDING"
	ErrCodeVerificationFailed  = "VERIFICATION_FAILED"

	// Matching errors
	ErrCodeAlreadySwiped = "MATCH_ALREADY_SWIPED"
	ErrCodeNotMatched    = "MATCH_NOT_MATCHED"
	ErrCodeSelfSwipe     = "MATCH_SELF_SWIPE"

	// Payment errors
	ErrCodePaymentFailed   = "PAYMENT_FAILED"
	ErrCodePaymentRequired = "PAYMENT_REQUIRED"

	// Server errors
	ErrCodeInternal = "INTERNAL_ERROR"
)

// DecodeJSON reads a JSON request body into dst. It returns an error message
// suitable for the client if decoding fails, or "" on success.
func DecodeJSON(r *http.Request, dst any) string {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		return "invalid request body"
	}
	return ""
}

// Pagination holds validated limit and offset values.
type Pagination struct {
	Limit   int
	Offset  int
	Page    int
	PerPage int
}

// ParseLimitOffset extracts limit and offset from query params with the given
// default limit and maximum limit. Invalid or out-of-range values fall back to
// defaults silently.
func ParseLimitOffset(r *http.Request, defaultLimit, maxLimit int) Pagination {
	p := Pagination{Limit: defaultLimit}

	if s := r.URL.Query().Get("limit"); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v > 0 {
			p.Limit = v
		}
	}
	if p.Limit > maxLimit {
		p.Limit = maxLimit
	}

	if s := r.URL.Query().Get("offset"); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v >= 0 {
			p.Offset = v
		}
	}

	// Derive page/per_page view from limit/offset for downstream callers.
	perPage := p.Limit
	if perPage <= 0 {
		perPage = defaultLimit
	}
	p.PerPage = perPage
	p.Page = (p.Offset / perPage) + 1

	return p
}

// ParsePagination extracts page/per_page style pagination parameters with
// defaults (1, 20) and max per_page of 100.
func ParsePagination(r *http.Request) (page, perPage int) {
	page = 1
	perPage = 20

	if raw := r.URL.Query().Get("page"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
			page = v
		}
	}
	if raw := r.URL.Query().Get("per_page"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
			perPage = v
		}
	}
	if perPage > 100 {
		perPage = 100
	}

	return page, perPage
}

// URLParamUUID parses a chi URL parameter as a UUID. On failure it writes a 400
// error response and returns uuid.Nil, false.
func URLParamUUID(w http.ResponseWriter, r *http.Request, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid "+name)
		return uuid.Nil, false
	}
	return id, true
}

// ParseUUIDParam extracts and validates a UUID path parameter from chi.
func ParseUUIDParam(r *http.Request, key string) (uuid.UUID, error) {
	id, err := uuid.Parse(chi.URLParam(r, key))
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid %s: %w", key, err)
	}
	return id, nil
}

// ParseDateRange extracts RFC3339 from/to query params.
func ParseDateRange(r *http.Request) (from, to time.Time, err error) {
	fromRaw := r.URL.Query().Get("from")
	toRaw := r.URL.Query().Get("to")
	if fromRaw == "" || toRaw == "" {
		return time.Time{}, time.Time{}, fmt.Errorf("from and to are required")
	}

	from, err = time.Parse(time.RFC3339, fromRaw)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid from: %w", err)
	}
	to, err = time.Parse(time.RFC3339, toRaw)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid to: %w", err)
	}
	if to.Before(from) {
		return time.Time{}, time.Time{}, fmt.Errorf("to must be after from")
	}
	return from, to, nil
}

// QueryUUID parses an optional query parameter as a UUID. If the parameter is
// absent it returns nil. If present but invalid it returns nil (silently
// ignored, matching the existing marketplace pattern).
func QueryUUID(r *http.Request, name string) *uuid.UUID {
	s := r.URL.Query().Get(name)
	if s == "" {
		return nil
	}
	id, err := uuid.Parse(s)
	if err != nil {
		return nil
	}
	return &id
}

// QueryInt parses an optional query parameter as an int. Returns the default
// value if absent or unparsable.
func QueryInt(r *http.Request, name string, defaultVal int) int {
	s := r.URL.Query().Get(name)
	if s == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return v
}

// QueryInt64 parses an optional query parameter as an int64. Returns nil if
// absent or unparsable.
func QueryInt64(r *http.Request, name string) *int64 {
	s := r.URL.Query().Get(name)
	if s == "" {
		return nil
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return nil
	}
	return &v
}

// QueryBool parses an optional query parameter as a boolean. Returns nil if
// absent; otherwise true if the value is "true" or "1".
func QueryBool(r *http.Request, name string) *bool {
	s := r.URL.Query().Get(name)
	if s == "" {
		return nil
	}
	v := s == "true" || s == "1"
	return &v
}
