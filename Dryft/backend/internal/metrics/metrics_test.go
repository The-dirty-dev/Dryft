package metrics

import (
	"bufio"
	"net"
	"net/http"
	"strings"
	"testing"
)

type hijackableWriter struct {
	header      http.Header
	status      int
	hijackCalls int
}

func (w *hijackableWriter) Header() http.Header {
	if w.header == nil {
		w.header = make(http.Header)
	}
	return w.header
}

func (w *hijackableWriter) Write(b []byte) (int, error) {
	return len(b), nil
}

func (w *hijackableWriter) WriteHeader(statusCode int) {
	w.status = statusCode
}

func (w *hijackableWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	w.hijackCalls++
	serverConn, clientConn := net.Pipe()
	_ = clientConn.Close()
	return serverConn, bufio.NewReadWriter(bufio.NewReader(serverConn), bufio.NewWriter(serverConn)), nil
}

type plainWriter struct {
	header http.Header
}

func (w *plainWriter) Header() http.Header {
	if w.header == nil {
		w.header = make(http.Header)
	}
	return w.header
}

func (w *plainWriter) Write(b []byte) (int, error) {
	return len(b), nil
}

func (w *plainWriter) WriteHeader(_ int) {}

func TestResponseWriterHijackDelegates(t *testing.T) {
	base := &hijackableWriter{}
	w := &responseWriter{ResponseWriter: base, statusCode: http.StatusOK}

	conn, rw, err := w.Hijack()
	if err != nil {
		t.Fatalf("expected Hijack to succeed, got error: %v", err)
	}
	if base.hijackCalls != 1 {
		t.Fatalf("expected Hijack to delegate exactly once, got %d", base.hijackCalls)
	}
	if conn == nil || rw == nil {
		t.Fatal("expected non-nil hijacked connection and readwriter")
	}
	_ = conn.Close()
}

func TestResponseWriterHijackReturnsErrorWhenUnsupported(t *testing.T) {
	base := &plainWriter{}
	w := &responseWriter{ResponseWriter: base, statusCode: http.StatusOK}

	conn, rw, err := w.Hijack()
	if err == nil {
		t.Fatal("expected error when underlying writer does not support hijacking")
	}
	if conn != nil || rw != nil {
		t.Fatal("expected nil connection/readwriter on hijack error")
	}
	if !strings.Contains(err.Error(), "does not support hijacking") {
		t.Fatalf("unexpected error message: %v", err)
	}
}
