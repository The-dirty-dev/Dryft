package settings

import (
	"reflect"
	"testing"
	"time"
)

func TestGetDefaults_HasExpectedCoreValues(t *testing.T) {
	svc := &Service{}
	defaults := svc.getDefaults()

	if !defaults.Notifications.Enabled || !defaults.Notifications.Messages {
		t.Fatalf("expected notifications to default enabled, got %+v", defaults.Notifications)
	}
	if defaults.Appearance.Theme != "dark" {
		t.Fatalf("expected dark theme default, got %q", defaults.Appearance.Theme)
	}
	if defaults.Matching.AgeRangeMin != 18 {
		t.Fatalf("expected minimum age default of 18, got %d", defaults.Matching.AgeRangeMin)
	}
}

func TestMergeSettings_ClientWinsWhenNewer(t *testing.T) {
	svc := &Service{}
	server := svc.getDefaults()
	client := server
	client.Appearance.Theme = "light"

	serverTime := time.Date(2026, 3, 2, 12, 0, 0, 0, time.UTC)
	clientTime := serverTime.Add(time.Hour)

	merged, conflicts := svc.mergeSettings(server, client, serverTime, &clientTime)
	if !reflect.DeepEqual(merged, client) {
		t.Fatalf("expected client settings to win when newer")
	}
	if len(conflicts) != 0 {
		t.Fatalf("expected no conflicts when client is newer, got %v", conflicts)
	}
}

func TestMergeSettings_ServerNewerReportsConflicts(t *testing.T) {
	svc := &Service{}
	server := svc.getDefaults()
	client := server
	client.Notifications.Marketing = true
	client.Matching.MaxDistance = 5

	serverTime := time.Date(2026, 3, 3, 9, 0, 0, 0, time.UTC)
	clientTime := serverTime.Add(-time.Hour)

	merged, conflicts := svc.mergeSettings(server, client, serverTime, &clientTime)
	if !reflect.DeepEqual(merged, server) {
		t.Fatalf("expected server settings to win when newer")
	}
	if len(conflicts) == 0 {
		t.Fatal("expected at least one conflict when settings diverge")
	}
}
