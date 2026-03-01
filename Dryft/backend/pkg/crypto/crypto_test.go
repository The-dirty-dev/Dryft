package crypto

import (
	"bytes"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// NewEncryptor
// ---------------------------------------------------------------------------

func TestNewEncryptor_Valid32ByteKey(t *testing.T) {
	key := strings.Repeat("a", 32)
	enc, err := NewEncryptor(key)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if enc == nil {
		t.Fatal("expected non-nil Encryptor")
	}
}

func TestNewEncryptor_InvalidKeyLengths(t *testing.T) {
	tests := []struct {
		name   string
		keyLen int
	}{
		{"empty key", 0},
		{"16-byte key", 16},
		{"31-byte key", 31},
		{"33-byte key", 33},
		{"64-byte key", 64},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			key := strings.Repeat("x", tc.keyLen)
			enc, err := NewEncryptor(key)
			if err == nil {
				t.Fatalf("expected error for key length %d, got nil", tc.keyLen)
			}
			if enc != nil {
				t.Fatal("expected nil Encryptor on error")
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Encrypt / Decrypt round-trip (string)
// ---------------------------------------------------------------------------

func TestEncryptDecrypt_RoundTrip(t *testing.T) {
	key := strings.Repeat("k", 32)
	enc, err := NewEncryptor(key)
	if err != nil {
		t.Fatalf("NewEncryptor: %v", err)
	}

	tests := []struct {
		name      string
		plaintext string
	}{
		{"empty string", ""},
		{"short text", "hello world"},
		{"unicode", "emoji: cafe\u0301 \U0001F600"},
		{"long text", strings.Repeat("abcdefghij", 1000)},
		{"special chars", "!@#$%^&*()_+-=[]{}|;':\",./<>?"},
		{"newlines and tabs", "line1\nline2\ttab"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ciphertext, err := enc.Encrypt(tc.plaintext)
			if err != nil {
				t.Fatalf("Encrypt: %v", err)
			}

			if ciphertext == tc.plaintext && tc.plaintext != "" {
				t.Error("ciphertext should differ from plaintext")
			}

			decrypted, err := enc.Decrypt(ciphertext)
			if err != nil {
				t.Fatalf("Decrypt: %v", err)
			}

			if decrypted != tc.plaintext {
				t.Errorf("round-trip failed: got %q, want %q", decrypted, tc.plaintext)
			}
		})
	}
}

func TestEncrypt_ProducesDifferentCiphertexts(t *testing.T) {
	key := strings.Repeat("k", 32)
	enc, err := NewEncryptor(key)
	if err != nil {
		t.Fatalf("NewEncryptor: %v", err)
	}

	plaintext := "same input"
	ct1, err := enc.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt 1: %v", err)
	}
	ct2, err := enc.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt 2: %v", err)
	}

	if ct1 == ct2 {
		t.Error("encrypting the same plaintext twice should produce different ciphertexts (random nonce)")
	}
}

func TestDecrypt_WrongKey(t *testing.T) {
	key1 := strings.Repeat("a", 32)
	key2 := strings.Repeat("b", 32)

	enc1, _ := NewEncryptor(key1)
	enc2, _ := NewEncryptor(key2)

	ct, err := enc1.Encrypt("secret")
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	_, err = enc2.Decrypt(ct)
	if err == nil {
		t.Fatal("expected error decrypting with wrong key")
	}
}

func TestDecrypt_InvalidBase64(t *testing.T) {
	key := strings.Repeat("k", 32)
	enc, _ := NewEncryptor(key)

	_, err := enc.Decrypt("not-valid-base64!!!")
	if err == nil {
		t.Fatal("expected error for invalid base64")
	}
}

func TestDecrypt_TooShortCiphertext(t *testing.T) {
	key := strings.Repeat("k", 32)
	enc, _ := NewEncryptor(key)

	// base64 encode a very short byte slice (shorter than GCM nonce)
	_, err := enc.Decrypt("AQID") // 3 bytes
	if err == nil {
		t.Fatal("expected error for ciphertext shorter than nonce")
	}
}

func TestDecrypt_TamperedCiphertext(t *testing.T) {
	key := strings.Repeat("k", 32)
	enc, _ := NewEncryptor(key)

	ct, _ := enc.Encrypt("important data")

	// Flip a character in the middle of the base64 string
	tampered := []byte(ct)
	mid := len(tampered) / 2
	if tampered[mid] == 'A' {
		tampered[mid] = 'B'
	} else {
		tampered[mid] = 'A'
	}

	_, err := enc.Decrypt(string(tampered))
	if err == nil {
		t.Fatal("expected error for tampered ciphertext (GCM authentication)")
	}
}

// ---------------------------------------------------------------------------
// EncryptBytes / DecryptBytes round-trip
// ---------------------------------------------------------------------------

func TestEncryptDecryptBytes_RoundTrip(t *testing.T) {
	key := strings.Repeat("k", 32)
	enc, _ := NewEncryptor(key)

	tests := []struct {
		name string
		data []byte
	}{
		{"nil data", nil},
		{"empty slice", []byte{}},
		{"binary data", []byte{0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd}},
		{"text as bytes", []byte("hello world")},
		{"large payload", bytes.Repeat([]byte{0xAB}, 10000)},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ct, err := enc.EncryptBytes(tc.data)
			if err != nil {
				t.Fatalf("EncryptBytes: %v", err)
			}

			pt, err := enc.DecryptBytes(ct)
			if err != nil {
				t.Fatalf("DecryptBytes: %v", err)
			}

			// For nil/empty input, GCM still produces valid output; compare lengths
			if len(tc.data) == 0 {
				if len(pt) != 0 {
					t.Errorf("expected empty plaintext, got %d bytes", len(pt))
				}
			} else if !bytes.Equal(pt, tc.data) {
				t.Errorf("round-trip failed: got %v, want %v", pt, tc.data)
			}
		})
	}
}

func TestEncryptBytes_ProducesDifferentCiphertexts(t *testing.T) {
	key := strings.Repeat("k", 32)
	enc, _ := NewEncryptor(key)

	data := []byte("same input bytes")
	ct1, _ := enc.EncryptBytes(data)
	ct2, _ := enc.EncryptBytes(data)

	if bytes.Equal(ct1, ct2) {
		t.Error("encrypting the same data twice should produce different ciphertexts")
	}
}

func TestDecryptBytes_WrongKey(t *testing.T) {
	enc1, _ := NewEncryptor(strings.Repeat("a", 32))
	enc2, _ := NewEncryptor(strings.Repeat("b", 32))

	ct, _ := enc1.EncryptBytes([]byte("secret"))
	_, err := enc2.DecryptBytes(ct)
	if err == nil {
		t.Fatal("expected error decrypting bytes with wrong key")
	}
}

func TestDecryptBytes_TooShort(t *testing.T) {
	enc, _ := NewEncryptor(strings.Repeat("k", 32))

	_, err := enc.DecryptBytes([]byte{1, 2, 3})
	if err == nil {
		t.Fatal("expected error for data shorter than nonce")
	}
}

// ---------------------------------------------------------------------------
// GenerateKey
// ---------------------------------------------------------------------------

func TestGenerateKey_Length(t *testing.T) {
	key, err := GenerateKey()
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}
	if len(key) != 32 {
		t.Errorf("expected 32-byte key, got %d bytes", len(key))
	}
}

func TestGenerateKey_Uniqueness(t *testing.T) {
	k1, _ := GenerateKey()
	k2, _ := GenerateKey()

	if k1 == k2 {
		t.Error("two generated keys should not be identical")
	}
}

func TestGenerateKey_UsableByEncryptor(t *testing.T) {
	key, err := GenerateKey()
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}

	enc, err := NewEncryptor(key)
	if err != nil {
		t.Fatalf("NewEncryptor with generated key: %v", err)
	}

	ct, err := enc.Encrypt("test")
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	pt, err := enc.Decrypt(ct)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}

	if pt != "test" {
		t.Errorf("expected %q, got %q", "test", pt)
	}
}

// ---------------------------------------------------------------------------
// GenerateSessionKey
// ---------------------------------------------------------------------------

func TestGenerateSessionKey_Length(t *testing.T) {
	key, err := GenerateSessionKey()
	if err != nil {
		t.Fatalf("GenerateSessionKey: %v", err)
	}
	if len(key) != 32 {
		t.Errorf("expected 32-byte session key, got %d bytes", len(key))
	}
}

func TestGenerateSessionKey_Uniqueness(t *testing.T) {
	k1, _ := GenerateSessionKey()
	k2, _ := GenerateSessionKey()

	if bytes.Equal(k1, k2) {
		t.Error("two generated session keys should not be identical")
	}
}
