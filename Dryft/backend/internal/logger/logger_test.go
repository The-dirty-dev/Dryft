package logger

import (
	"testing"
)

func TestInit_DoesNotPanic(t *testing.T) {
	environments := []struct {
		name string
		env  string
	}{
		{"development", "development"},
		{"production", "production"},
		{"staging", "staging"},
		{"empty string", ""},
	}

	for _, tc := range environments {
		t.Run(tc.name, func(t *testing.T) {
			defer func() {
				if r := recover(); r != nil {
					t.Errorf("Init(%q) panicked: %v", tc.env, r)
				}
			}()

			Init(tc.env)
		})
	}
}
