package httputil

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func TestWriteJSON(t *testing.T) {
	w := httptest.NewRecorder()
	WriteJSON(w, http.StatusCreated, map[string]string{"key": "value"})

	if w.Code != http.StatusCreated {
		t.Errorf("expected status 201, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}

	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}
	if body["key"] != "value" {
		t.Errorf("expected key=value, got key=%s", body["key"])
	}
}

func TestWriteError(t *testing.T) {
	w := httptest.NewRecorder()
	WriteError(w, http.StatusBadRequest, "bad input")

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}

	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if body["error"] != "bad input" {
		t.Errorf("expected error=bad input, got %q", body["error"])
	}
}

func TestDecodeJSON_Valid(t *testing.T) {
	type payload struct {
		Name string `json:"name"`
	}
	body := bytes.NewBufferString(`{"name":"Alice"}`)
	r := httptest.NewRequest(http.MethodPost, "/", body)

	var p payload
	if msg := DecodeJSON(r, &p); msg != "" {
		t.Fatalf("expected no error, got %q", msg)
	}
	if p.Name != "Alice" {
		t.Errorf("expected Name=Alice, got %q", p.Name)
	}
}

func TestDecodeJSON_Invalid(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(`{invalid`))

	var p struct{ Name string }
	if msg := DecodeJSON(r, &p); msg == "" {
		t.Fatal("expected error message for invalid JSON")
	}
}

func TestParsePagination_Defaults(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	p := ParseLimitOffset(r, 20, 100)

	if p.Limit != 20 {
		t.Errorf("expected limit 20, got %d", p.Limit)
	}
	if p.Offset != 0 {
		t.Errorf("expected offset 0, got %d", p.Offset)
	}
}

func TestParsePagination_Custom(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/?limit=50&offset=10", nil)
	p := ParseLimitOffset(r, 20, 100)

	if p.Limit != 50 {
		t.Errorf("expected limit 50, got %d", p.Limit)
	}
	if p.Offset != 10 {
		t.Errorf("expected offset 10, got %d", p.Offset)
	}
}

func TestParsePagination_CapsAtMax(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/?limit=500", nil)
	p := ParseLimitOffset(r, 20, 100)

	if p.Limit != 100 {
		t.Errorf("expected limit capped at 100, got %d", p.Limit)
	}
}

func TestParsePagination_InvalidFallsBack(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/?limit=abc&offset=-5", nil)
	p := ParseLimitOffset(r, 20, 100)

	if p.Limit != 20 {
		t.Errorf("expected default limit 20, got %d", p.Limit)
	}
	if p.Offset != 0 {
		t.Errorf("expected default offset 0 for negative value, got %d", p.Offset)
	}
}

func TestParsePagination_ZeroLimit(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/?limit=0", nil)
	p := ParseLimitOffset(r, 20, 100)

	if p.Limit != 20 {
		t.Errorf("expected default limit 20 for zero value, got %d", p.Limit)
	}
}

func TestQueryUUID_Present(t *testing.T) {
	id := uuid.New()
	r := httptest.NewRequest(http.MethodGet, "/?id="+id.String(), nil)
	result := QueryUUID(r, "id")

	if result == nil {
		t.Fatal("expected non-nil UUID")
	}
	if *result != id {
		t.Errorf("expected %s, got %s", id, *result)
	}
}

func TestQueryUUID_Absent(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	result := QueryUUID(r, "id")

	if result != nil {
		t.Error("expected nil for absent parameter")
	}
}

func TestQueryUUID_Invalid(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/?id=not-a-uuid", nil)
	result := QueryUUID(r, "id")

	if result != nil {
		t.Error("expected nil for invalid UUID")
	}
}

func TestQueryInt_Present(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/?count=42", nil)
	result := QueryInt(r, "count", 10)

	if result != 42 {
		t.Errorf("expected 42, got %d", result)
	}
}

func TestQueryInt_Default(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	result := QueryInt(r, "count", 10)

	if result != 10 {
		t.Errorf("expected default 10, got %d", result)
	}
}

func TestQueryInt_Invalid(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/?count=abc", nil)
	result := QueryInt(r, "count", 10)

	if result != 10 {
		t.Errorf("expected default 10 for invalid int, got %d", result)
	}
}

func TestQueryInt64_Present(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/?price=9999", nil)
	result := QueryInt64(r, "price")

	if result == nil {
		t.Fatal("expected non-nil")
	}
	if *result != 9999 {
		t.Errorf("expected 9999, got %d", *result)
	}
}

func TestQueryInt64_Absent(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	result := QueryInt64(r, "price")

	if result != nil {
		t.Error("expected nil for absent parameter")
	}
}

func TestQueryBool_True(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/?featured=true", nil)
	result := QueryBool(r, "featured")

	if result == nil || !*result {
		t.Error("expected true")
	}
}

func TestQueryBool_One(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/?featured=1", nil)
	result := QueryBool(r, "featured")

	if result == nil || !*result {
		t.Error("expected true for value '1'")
	}
}

func TestQueryBool_False(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/?featured=false", nil)
	result := QueryBool(r, "featured")

	if result == nil || *result {
		t.Error("expected false")
	}
}

func TestQueryBool_Absent(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	result := QueryBool(r, "featured")

	if result != nil {
		t.Error("expected nil for absent parameter")
	}
}

func TestParsePagination_PagePerPage(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/?page=3&per_page=15", nil)
	page, perPage := ParsePagination(r)
	if page != 3 {
		t.Fatalf("expected page=3, got %d", page)
	}
	if perPage != 15 {
		t.Fatalf("expected per_page=15, got %d", perPage)
	}
}

func TestParsePagination_PagePerPageBounds(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/?page=-1&per_page=1000", nil)
	page, perPage := ParsePagination(r)
	if page != 1 {
		t.Fatalf("expected bounded page=1, got %d", page)
	}
	if perPage != 100 {
		t.Fatalf("expected bounded per_page=100, got %d", perPage)
	}
}

func TestParseUUIDParam(t *testing.T) {
	id := uuid.New()
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("itemID", id.String())
	req := httptest.NewRequest(http.MethodGet, "/items/"+id.String(), nil)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	got, err := ParseUUIDParam(req, "itemID")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != id {
		t.Fatalf("expected %s, got %s", id, got)
	}
}

func TestParseUUIDParamInvalid(t *testing.T) {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("itemID", "bad")
	req := httptest.NewRequest(http.MethodGet, "/items/bad", nil)
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	if _, err := ParseUUIDParam(req, "itemID"); err == nil {
		t.Fatal("expected error")
	}
}

func TestParseDateRange(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/?from=2026-03-01T00:00:00Z&to=2026-03-02T00:00:00Z", nil)
	from, to, err := ParseDateRange(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !from.Equal(time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("unexpected from: %s", from)
	}
	if !to.Equal(time.Date(2026, 3, 2, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("unexpected to: %s", to)
	}
}

func TestParseDateRangeInvalidOrder(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/?from=2026-03-03T00:00:00Z&to=2026-03-02T00:00:00Z", nil)
	if _, _, err := ParseDateRange(req); err == nil {
		t.Fatal("expected error")
	}
}
