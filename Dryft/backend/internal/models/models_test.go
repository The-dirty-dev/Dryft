package models

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// user.go tests
// ---------------------------------------------------------------------------

func TestUser_ToPublicProfile_WithPhotoURL(t *testing.T) {
	displayName := "Alice"
	bio := "Hello!"
	photo := "photos/alice.jpg"
	u := &User{
		ID:           uuid.New(),
		DisplayName:  &displayName,
		Bio:          &bio,
		ProfilePhoto: &photo,
		Verified:     true,
	}

	url := "https://cdn.example.com/photos/alice.jpg"
	p := u.ToPublicProfile(url)

	if p.ID != u.ID {
		t.Errorf("expected ID %v, got %v", u.ID, p.ID)
	}
	if p.DisplayName == nil || *p.DisplayName != displayName {
		t.Errorf("expected DisplayName %q, got %v", displayName, p.DisplayName)
	}
	if p.Bio == nil || *p.Bio != bio {
		t.Errorf("expected Bio %q, got %v", bio, p.Bio)
	}
	if p.ProfilePhoto == nil || *p.ProfilePhoto != url {
		t.Errorf("expected ProfilePhoto %q, got %v", url, p.ProfilePhoto)
	}
	if !p.Verified {
		t.Error("expected Verified to be true")
	}
}

func TestUser_ToPublicProfile_EmptyPhotoURL(t *testing.T) {
	u := &User{ID: uuid.New()}
	p := u.ToPublicProfile("")

	if p.ProfilePhoto != nil {
		t.Errorf("expected ProfilePhoto to be nil for empty URL, got %v", *p.ProfilePhoto)
	}
}

func TestUser_ToPublicProfile_NilOptionalFields(t *testing.T) {
	u := &User{ID: uuid.New()}
	p := u.ToPublicProfile("https://example.com/img.jpg")

	if p.DisplayName != nil {
		t.Error("expected DisplayName to be nil")
	}
	if p.Bio != nil {
		t.Error("expected Bio to be nil")
	}
}

func TestUser_IsDeleted(t *testing.T) {
	u := &User{}
	if u.IsDeleted() {
		t.Error("expected IsDeleted() false when DeletedAt is nil")
	}

	now := time.Now()
	u.DeletedAt = &now
	if !u.IsDeleted() {
		t.Error("expected IsDeleted() true when DeletedAt is set")
	}
}

func TestUser_CanStartVerification(t *testing.T) {
	tests := []struct {
		name     string
		photo    *string
		verified bool
		want     bool
	}{
		{
			name:     "nil photo",
			photo:    nil,
			verified: false,
			want:     false,
		},
		{
			name:     "empty photo string",
			photo:    strPtr(""),
			verified: false,
			want:     false,
		},
		{
			name:     "has photo, not verified",
			photo:    strPtr("photos/me.jpg"),
			verified: false,
			want:     true,
		},
		{
			name:     "has photo, already verified",
			photo:    strPtr("photos/me.jpg"),
			verified: true,
			want:     false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u := &User{
				ProfilePhoto: tt.photo,
				Verified:     tt.verified,
			}
			if got := u.CanStartVerification(); got != tt.want {
				t.Errorf("CanStartVerification() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestUser_PasswordHashOmittedInJSON(t *testing.T) {
	u := User{
		ID:           uuid.New(),
		Email:        "test@example.com",
		PasswordHash: "supersecret",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	data, err := json.Marshal(u)
	if err != nil {
		t.Fatalf("failed to marshal user: %v", err)
	}
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	if _, ok := m["password_hash"]; ok {
		t.Error("password_hash should not appear in JSON output (json:\"-\")")
	}
}

func TestUser_DeletedAtOmittedInJSON(t *testing.T) {
	now := time.Now()
	u := User{
		ID:        uuid.New(),
		Email:     "test@example.com",
		DeletedAt: &now,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	data, err := json.Marshal(u)
	if err != nil {
		t.Fatalf("failed to marshal user: %v", err)
	}
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	if _, ok := m["deleted_at"]; ok {
		t.Error("deleted_at should not appear in JSON output (json:\"-\")")
	}
}

// ---------------------------------------------------------------------------
// matching.go tests
// ---------------------------------------------------------------------------

func TestOrderedUserIDs(t *testing.T) {
	// Use deterministic UUIDs so we know string ordering.
	a := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	b := uuid.MustParse("ffffffff-ffff-ffff-ffff-ffffffffffff")

	first, second := OrderedUserIDs(a, b)
	if first != a || second != b {
		t.Errorf("OrderedUserIDs(a, b) = (%v, %v), want (%v, %v)", first, second, a, b)
	}

	// Reversed input should yield same ordering.
	first, second = OrderedUserIDs(b, a)
	if first != a || second != b {
		t.Errorf("OrderedUserIDs(b, a) = (%v, %v), want (%v, %v)", first, second, a, b)
	}
}

func TestOrderedUserIDs_SameUUID(t *testing.T) {
	id := uuid.MustParse("abcdefab-cdef-abcd-efab-cdefabcdefab")
	first, second := OrderedUserIDs(id, id)
	if first != id || second != id {
		t.Errorf("expected both IDs to be %v, got (%v, %v)", id, first, second)
	}
}

func TestMatch_IsActive(t *testing.T) {
	m := &Match{}
	if !m.IsActive() {
		t.Error("expected IsActive() true when UnmatchedAt is nil")
	}

	now := time.Now()
	m.UnmatchedAt = &now
	if m.IsActive() {
		t.Error("expected IsActive() false when UnmatchedAt is set")
	}
}

func TestMatch_GetOtherUserID(t *testing.T) {
	a := uuid.New()
	b := uuid.New()
	m := &Match{UserAID: a, UserBID: b}

	if got := m.GetOtherUserID(a); got != b {
		t.Errorf("GetOtherUserID(%v) = %v, want %v", a, got, b)
	}
	if got := m.GetOtherUserID(b); got != a {
		t.Errorf("GetOtherUserID(%v) = %v, want %v", b, got, a)
	}
}

// ---------------------------------------------------------------------------
// chat.go tests
// ---------------------------------------------------------------------------

func TestConversation_GetOtherUserID(t *testing.T) {
	a := uuid.New()
	b := uuid.New()
	c := &Conversation{UserAID: a, UserBID: b}

	if got := c.GetOtherUserID(a); got != b {
		t.Errorf("GetOtherUserID(%v) = %v, want %v", a, got, b)
	}
	if got := c.GetOtherUserID(b); got != a {
		t.Errorf("GetOtherUserID(%v) = %v, want %v", b, got, a)
	}
}

func TestMessage_TruncateContent_TextShort(t *testing.T) {
	m := &Message{Type: MessageTypeText, Content: "Hello"}
	got := m.TruncateContent(20)
	if got != "Hello" {
		t.Errorf("expected %q, got %q", "Hello", got)
	}
}

func TestMessage_TruncateContent_TextExactLength(t *testing.T) {
	m := &Message{Type: MessageTypeText, Content: "abcde"}
	got := m.TruncateContent(5)
	if got != "abcde" {
		t.Errorf("expected %q, got %q", "abcde", got)
	}
}

func TestMessage_TruncateContent_TextTruncated(t *testing.T) {
	m := &Message{Type: MessageTypeText, Content: "Hello, this is a very long message"}
	got := m.TruncateContent(10)
	expected := "Hello, ..."
	if got != expected {
		t.Errorf("expected %q, got %q", expected, got)
	}
}

func TestMessage_TruncateContent_ImageType(t *testing.T) {
	m := &Message{Type: MessageTypeImage, Content: "https://example.com/photo.jpg"}
	got := m.TruncateContent(100)
	if got != "📷 Photo" {
		t.Errorf("expected photo indicator, got %q", got)
	}
}

func TestMessage_TruncateContent_GifType(t *testing.T) {
	m := &Message{Type: MessageTypeGif, Content: "https://example.com/funny.gif"}
	got := m.TruncateContent(100)
	if got != "🎬 GIF" {
		t.Errorf("expected gif indicator, got %q", got)
	}
}

func TestMessage_TruncateContent_UnknownMediaType(t *testing.T) {
	m := &Message{Type: MessageType("video"), Content: "https://example.com/clip.mp4"}
	got := m.TruncateContent(100)
	if got != "📎 Media" {
		t.Errorf("expected media indicator, got %q", got)
	}
}

func TestMessage_ToPreview_UnreadMessage(t *testing.T) {
	id := uuid.New()
	senderID := uuid.New()
	now := time.Now()

	m := &Message{
		ID:        id,
		SenderID:  senderID,
		Type:      MessageTypeText,
		Content:   "Hey there! How are you doing today?",
		ReadAt:    nil,
		CreatedAt: now,
	}

	preview := m.ToPreview(15)

	if preview.ID != id {
		t.Errorf("expected ID %v, got %v", id, preview.ID)
	}
	if preview.SenderID != senderID {
		t.Errorf("expected SenderID %v, got %v", senderID, preview.SenderID)
	}
	if preview.Type != MessageTypeText {
		t.Errorf("expected Type %v, got %v", MessageTypeText, preview.Type)
	}
	if preview.Preview != "Hey there! H..." {
		t.Errorf("expected truncated preview, got %q", preview.Preview)
	}
	if preview.CreatedAt != now {
		t.Error("expected CreatedAt to match")
	}
	if preview.IsRead {
		t.Error("expected IsRead to be false for unread message")
	}
}

func TestMessage_ToPreview_ReadMessage(t *testing.T) {
	now := time.Now()
	m := &Message{
		ID:        uuid.New(),
		SenderID:  uuid.New(),
		Type:      MessageTypeText,
		Content:   "Read msg",
		ReadAt:    &now,
		CreatedAt: now,
	}

	preview := m.ToPreview(100)
	if !preview.IsRead {
		t.Error("expected IsRead to be true for read message")
	}
}

// ---------------------------------------------------------------------------
// marketplace.go tests
// ---------------------------------------------------------------------------

func TestCalculatePayoutSplit(t *testing.T) {
	tests := []struct {
		name          string
		price         int64
		wantFee       int64
		wantPayout    int64
	}{
		{
			name:       "100 cents ($1.00)",
			price:      100,
			wantFee:    15,
			wantPayout: 85,
		},
		{
			name:       "1000 cents ($10.00)",
			price:      1000,
			wantFee:    150,
			wantPayout: 850,
		},
		{
			name:       "zero price",
			price:      0,
			wantFee:    0,
			wantPayout: 0,
		},
		{
			name:       "1 cent (minimum)",
			price:      1,
			wantFee:    0,
			wantPayout: 1,
		},
		{
			name:       "999 cents",
			price:      999,
			wantFee:    149,
			wantPayout: 850,
		},
		{
			name:       "large price 100000 cents ($1000)",
			price:      100000,
			wantFee:    15000,
			wantPayout: 85000,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fee, payout := CalculatePayoutSplit(tt.price)
			if fee != tt.wantFee {
				t.Errorf("fee = %d, want %d", fee, tt.wantFee)
			}
			if payout != tt.wantPayout {
				t.Errorf("payout = %d, want %d", payout, tt.wantPayout)
			}
		})
	}
}

func TestCalculatePayoutSplit_SumsToPrice(t *testing.T) {
	// For any price, fee + payout should equal the original price.
	prices := []int64{0, 1, 2, 7, 10, 99, 100, 333, 500, 999, 1000, 5000, 9999, 100000}
	for _, price := range prices {
		fee, payout := CalculatePayoutSplit(price)
		if fee+payout != price {
			t.Errorf("fee(%d) + payout(%d) = %d, want %d", fee, payout, fee+payout, price)
		}
	}
}

func TestPlatformFeePercent(t *testing.T) {
	if PlatformFeePercent != 15 {
		t.Errorf("PlatformFeePercent = %d, want 15", PlatformFeePercent)
	}
}

func TestStoreItem_DeletedAtOmittedInJSON(t *testing.T) {
	now := time.Now()
	item := StoreItem{
		ID:        uuid.New(),
		DeletedAt: &now,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	data, err := json.Marshal(item)
	if err != nil {
		t.Fatalf("failed to marshal StoreItem: %v", err)
	}
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	if _, ok := m["deleted_at"]; ok {
		t.Error("deleted_at should not appear in JSON output for StoreItem")
	}
}

// ---------------------------------------------------------------------------
// verification.go tests
// ---------------------------------------------------------------------------

func TestVerificationAttempt_CalculateAge(t *testing.T) {
	// Person born 25 years ago today.
	dob := time.Now().AddDate(-25, 0, 0)
	v := &VerificationAttempt{JumioDOB: &dob}
	age := v.CalculateAge()
	if age != 25 {
		t.Errorf("CalculateAge() = %d, want 25", age)
	}
}

func TestVerificationAttempt_CalculateAge_BeforeBirthdayThisYear(t *testing.T) {
	// Person born 20 years ago, but birthday is tomorrow.
	dob := time.Now().AddDate(-20, 0, 1)
	v := &VerificationAttempt{JumioDOB: &dob}
	age := v.CalculateAge()
	if age != 19 {
		t.Errorf("CalculateAge() = %d, want 19 (birthday hasn't happened yet this year)", age)
	}
}

func TestVerificationAttempt_CalculateAge_NilDOB(t *testing.T) {
	v := &VerificationAttempt{JumioDOB: nil}
	age := v.CalculateAge()
	if age != 0 {
		t.Errorf("CalculateAge() = %d, want 0 for nil DOB", age)
	}
}

func TestVerificationAttempt_IsAdult(t *testing.T) {
	tests := []struct {
		name string
		dob  *time.Time
		want bool
	}{
		{
			name: "nil DOB",
			dob:  nil,
			want: false,
		},
		{
			name: "17 years old",
			dob:  timePtr(time.Now().AddDate(-17, 0, 0)),
			want: false,
		},
		{
			name: "18 years old",
			dob:  timePtr(time.Now().AddDate(-18, 0, 0)),
			want: true,
		},
		{
			name: "30 years old",
			dob:  timePtr(time.Now().AddDate(-30, 0, 0)),
			want: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			v := &VerificationAttempt{JumioDOB: tt.dob}
			if got := v.IsAdult(); got != tt.want {
				t.Errorf("IsAdult() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestVerificationAttempt_ToStatusResponse_Pending(t *testing.T) {
	v := &VerificationAttempt{
		OverallStatus: VerificationStatusPending,
		StripeVerified: false,
		JumioStatus:    JumioStatusPending,
	}
	resp := v.ToStatusResponse()

	if resp.Status != VerificationStatusPending {
		t.Errorf("Status = %v, want %v", resp.Status, VerificationStatusPending)
	}
	if resp.CardVerified {
		t.Error("expected CardVerified false")
	}
	if resp.IDVerified {
		t.Error("expected IDVerified false")
	}
	if resp.FaceMatchVerified {
		t.Error("expected FaceMatchVerified false")
	}
	if resp.CanRetry {
		t.Error("expected CanRetry false for pending status")
	}
}

func TestVerificationAttempt_ToStatusResponse_Verified(t *testing.T) {
	passed := true
	v := &VerificationAttempt{
		OverallStatus:  VerificationStatusVerified,
		StripeVerified: true,
		JumioStatus:    JumioStatusApproved,
		FaceMatchPassed: &passed,
	}
	resp := v.ToStatusResponse()

	if resp.Status != VerificationStatusVerified {
		t.Errorf("Status = %v, want %v", resp.Status, VerificationStatusVerified)
	}
	if !resp.CardVerified {
		t.Error("expected CardVerified true")
	}
	if !resp.IDVerified {
		t.Error("expected IDVerified true")
	}
	if !resp.FaceMatchVerified {
		t.Error("expected FaceMatchVerified true")
	}
}

func TestVerificationAttempt_ToStatusResponse_RejectedCanRetry(t *testing.T) {
	v := &VerificationAttempt{
		OverallStatus:      VerificationStatusRejected,
		RetryCooldownUntil: nil, // No cooldown set
	}
	resp := v.ToStatusResponse()

	if !resp.CanRetry {
		t.Error("expected CanRetry true when rejected with no cooldown")
	}
	if resp.RetryAvailableAt != nil {
		t.Error("expected RetryAvailableAt nil when can retry now")
	}
}

func TestVerificationAttempt_ToStatusResponse_RejectedCooldownActive(t *testing.T) {
	future := time.Now().Add(1 * time.Hour)
	v := &VerificationAttempt{
		OverallStatus:      VerificationStatusRejected,
		RetryCooldownUntil: &future,
	}
	resp := v.ToStatusResponse()

	if resp.CanRetry {
		t.Error("expected CanRetry false when cooldown is active")
	}
	if resp.RetryAvailableAt == nil {
		t.Fatal("expected RetryAvailableAt to be set")
	}
	if !resp.RetryAvailableAt.Equal(future) {
		t.Errorf("RetryAvailableAt = %v, want %v", resp.RetryAvailableAt, future)
	}
}

func TestVerificationAttempt_ToStatusResponse_RejectedCooldownExpired(t *testing.T) {
	past := time.Now().Add(-1 * time.Hour)
	v := &VerificationAttempt{
		OverallStatus:      VerificationStatusRejected,
		RetryCooldownUntil: &past,
	}
	resp := v.ToStatusResponse()

	if !resp.CanRetry {
		t.Error("expected CanRetry true when cooldown has expired")
	}
}

func TestVerificationAttempt_ToStatusResponse_FaceMatchFalse(t *testing.T) {
	failed := false
	v := &VerificationAttempt{
		OverallStatus:   VerificationStatusRejected,
		FaceMatchPassed: &failed,
	}
	resp := v.ToStatusResponse()

	if resp.FaceMatchVerified {
		t.Error("expected FaceMatchVerified false when FaceMatchPassed is false")
	}
}

func TestVerificationAttempt_ToStatusResponse_FaceMatchNil(t *testing.T) {
	v := &VerificationAttempt{
		OverallStatus:   VerificationStatusPending,
		FaceMatchPassed: nil,
	}
	resp := v.ToStatusResponse()

	if resp.FaceMatchVerified {
		t.Error("expected FaceMatchVerified false when FaceMatchPassed is nil")
	}
}

func TestVerificationAttempt_ToStatusResponse_RejectionReason(t *testing.T) {
	reason := "Document expired"
	v := &VerificationAttempt{
		OverallStatus:   VerificationStatusRejected,
		RejectionReason: &reason,
	}
	resp := v.ToStatusResponse()

	if resp.RejectionReason == nil || *resp.RejectionReason != reason {
		t.Errorf("expected RejectionReason %q, got %v", reason, resp.RejectionReason)
	}
}

func TestVerificationAttempt_SensitiveFieldsOmittedInJSON(t *testing.T) {
	custID := "cus_test123"
	scanRef := "scan_ref_123"
	dob := time.Date(1990, 1, 15, 0, 0, 0, 0, time.UTC)
	score := 0.95
	method := "aws_rekognition"
	reviewerID := uuid.New()

	v := VerificationAttempt{
		ID:               uuid.New(),
		UserID:           uuid.New(),
		StripeCustomerID: &custID,
		JumioScanRef:     &scanRef,
		JumioDOB:         &dob,
		FaceMatchScore:   &score,
		FaceMatchMethod:  &method,
		ReviewedBy:       &reviewerID,
		OverallStatus:    VerificationStatusVerified,
		JumioStatus:      JumioStatusApproved,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	data, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("failed to marshal VerificationAttempt: %v", err)
	}

	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	sensitiveFields := []string{
		"stripe_customer_id",
		"jumio_scan_ref",
		"jumio_dob",
		"face_match_score",
		"face_match_method",
		"reviewed_by",
	}
	for _, field := range sensitiveFields {
		if _, ok := m[field]; ok {
			t.Errorf("sensitive field %q should not appear in JSON output", field)
		}
	}
}

func TestVerificationConstants(t *testing.T) {
	if RetryCooldownDuration != 24*time.Hour {
		t.Errorf("RetryCooldownDuration = %v, want 24h", RetryCooldownDuration)
	}
	if MaxRetryCount != 3 {
		t.Errorf("MaxRetryCount = %d, want 3", MaxRetryCount)
	}
}

// ---------------------------------------------------------------------------
// haptic.go tests
// ---------------------------------------------------------------------------

func TestHapticDevice_ToPublic(t *testing.T) {
	displayName := "My Toy"
	d := &HapticDevice{
		ID:          uuid.New(),
		UserID:      uuid.New(),
		DeviceIndex: 0,
		DeviceName:  "Lovense Lush 3",
		DeviceAddress: strPtr("AA:BB:CC:DD:EE:FF"),
		CanVibrate:  true,
		CanRotate:   false,
		CanLinear:   false,
		CanBattery:  true,
		DisplayName: &displayName,
		IsPrimary:   true,
		MaxIntensity: 0.8,
	}

	pub := d.ToPublic()

	if pub.ID != d.ID {
		t.Errorf("expected ID %v, got %v", d.ID, pub.ID)
	}
	if pub.DeviceName != d.DeviceName {
		t.Errorf("expected DeviceName %q, got %q", d.DeviceName, pub.DeviceName)
	}
	if pub.DisplayName == nil || *pub.DisplayName != displayName {
		t.Errorf("expected DisplayName %q, got %v", displayName, pub.DisplayName)
	}
	if !pub.CanVibrate {
		t.Error("expected CanVibrate true")
	}
	if pub.CanRotate {
		t.Error("expected CanRotate false")
	}
	if pub.CanLinear {
		t.Error("expected CanLinear false")
	}
	if !pub.IsPrimary {
		t.Error("expected IsPrimary true")
	}
}

func TestHapticDevice_ToPublic_ExcludesSensitiveFields(t *testing.T) {
	d := &HapticDevice{
		ID:            uuid.New(),
		UserID:        uuid.New(),
		DeviceIndex:   2,
		DeviceName:    "Test Device",
		DeviceAddress: strPtr("AA:BB:CC:DD:EE:FF"),
		MaxIntensity:  1.0,
	}

	pub := d.ToPublic()

	// The public struct should not expose UserID, DeviceIndex, DeviceAddress,
	// MaxIntensity, etc. We verify by marshaling to JSON and checking fields.
	data, err := json.Marshal(pub)
	if err != nil {
		t.Fatalf("failed to marshal HapticDevicePublic: %v", err)
	}
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	excludedFields := []string{"user_id", "device_index", "device_address", "max_intensity", "can_battery"}
	for _, field := range excludedFields {
		if _, ok := m[field]; ok {
			t.Errorf("field %q should not be in public device JSON", field)
		}
	}
}

func TestHapticPermission_IsActive(t *testing.T) {
	tests := []struct {
		name      string
		revokedAt *time.Time
		expiresAt *time.Time
		want      bool
	}{
		{
			name: "active - no revocation, no expiry",
			want: true,
		},
		{
			name:      "revoked",
			revokedAt: timePtr(time.Now().Add(-1 * time.Hour)),
			want:      false,
		},
		{
			name:      "expired",
			expiresAt: timePtr(time.Now().Add(-1 * time.Hour)),
			want:      false,
		},
		{
			name:      "not yet expired",
			expiresAt: timePtr(time.Now().Add(1 * time.Hour)),
			want:      true,
		},
		{
			name:      "revoked and expired",
			revokedAt: timePtr(time.Now().Add(-2 * time.Hour)),
			expiresAt: timePtr(time.Now().Add(-1 * time.Hour)),
			want:      false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := &HapticPermission{
				RevokedAt: tt.revokedAt,
				ExpiresAt: tt.expiresAt,
			}
			if got := p.IsActive(); got != tt.want {
				t.Errorf("IsActive() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestHapticPattern_MarshalUnmarshalPatternData(t *testing.T) {
	pattern := &HapticPattern{
		ID:   uuid.New(),
		Name: "Test Pattern",
		PatternData: []PatternStep{
			{TimeMS: 0, Intensity: 0.5, MotorIndex: 0},
			{TimeMS: 500, Intensity: 1.0, MotorIndex: 0},
			{TimeMS: 1000, Intensity: 0.0, MotorIndex: 0},
		},
		DurationMS: 1000,
	}

	data, err := pattern.MarshalPatternData()
	if err != nil {
		t.Fatalf("MarshalPatternData() error: %v", err)
	}

	// Unmarshal into a new pattern and verify.
	pattern2 := &HapticPattern{}
	if err := pattern2.UnmarshalPatternData(data); err != nil {
		t.Fatalf("UnmarshalPatternData() error: %v", err)
	}

	if len(pattern2.PatternData) != 3 {
		t.Fatalf("expected 3 pattern steps, got %d", len(pattern2.PatternData))
	}

	for i, step := range pattern.PatternData {
		got := pattern2.PatternData[i]
		if got.TimeMS != step.TimeMS {
			t.Errorf("step[%d].TimeMS = %d, want %d", i, got.TimeMS, step.TimeMS)
		}
		if got.Intensity != step.Intensity {
			t.Errorf("step[%d].Intensity = %f, want %f", i, got.Intensity, step.Intensity)
		}
		if got.MotorIndex != step.MotorIndex {
			t.Errorf("step[%d].MotorIndex = %d, want %d", i, got.MotorIndex, step.MotorIndex)
		}
	}
}

func TestHapticPattern_MarshalEmptyPatternData(t *testing.T) {
	pattern := &HapticPattern{PatternData: []PatternStep{}}
	data, err := pattern.MarshalPatternData()
	if err != nil {
		t.Fatalf("MarshalPatternData() error: %v", err)
	}

	pattern2 := &HapticPattern{}
	if err := pattern2.UnmarshalPatternData(data); err != nil {
		t.Fatalf("UnmarshalPatternData() error: %v", err)
	}

	if len(pattern2.PatternData) != 0 {
		t.Errorf("expected 0 steps, got %d", len(pattern2.PatternData))
	}
}

func TestHapticPattern_UnmarshalInvalidJSON(t *testing.T) {
	pattern := &HapticPattern{}
	err := pattern.UnmarshalPatternData(json.RawMessage(`{invalid`))
	if err == nil {
		t.Error("expected error for invalid JSON, got nil")
	}
}

// ---------------------------------------------------------------------------
// Type constant value tests
// ---------------------------------------------------------------------------

func TestMessageTypeConstants(t *testing.T) {
	if MessageTypeText != "text" {
		t.Errorf("MessageTypeText = %q, want %q", MessageTypeText, "text")
	}
	if MessageTypeImage != "image" {
		t.Errorf("MessageTypeImage = %q, want %q", MessageTypeImage, "image")
	}
	if MessageTypeGif != "gif" {
		t.Errorf("MessageTypeGif = %q, want %q", MessageTypeGif, "gif")
	}
}

func TestSwipeDirectionConstants(t *testing.T) {
	if SwipeLike != "like" {
		t.Errorf("SwipeLike = %q, want %q", SwipeLike, "like")
	}
	if SwipePass != "pass" {
		t.Errorf("SwipePass = %q, want %q", SwipePass, "pass")
	}
}

func TestItemTypeConstants(t *testing.T) {
	expected := map[ItemType]string{
		ItemTypeAvatar:  "avatar",
		ItemTypeOutfit:  "outfit",
		ItemTypeToy:     "toy",
		ItemTypeEffect:  "effect",
		ItemTypeGesture: "gesture",
	}
	for got, want := range expected {
		if string(got) != want {
			t.Errorf("ItemType constant = %q, want %q", got, want)
		}
	}
}

func TestItemStatusConstants(t *testing.T) {
	expected := map[ItemStatus]string{
		ItemStatusDraft:    "draft",
		ItemStatusPending:  "pending",
		ItemStatusApproved: "approved",
		ItemStatusRejected: "rejected",
		ItemStatusDisabled: "disabled",
	}
	for got, want := range expected {
		if string(got) != want {
			t.Errorf("ItemStatus constant = %q, want %q", got, want)
		}
	}
}

func TestPurchaseStatusConstants(t *testing.T) {
	expected := map[PurchaseStatus]string{
		PurchaseStatusPending:   "pending",
		PurchaseStatusCompleted: "completed",
		PurchaseStatusRefunded:  "refunded",
		PurchaseStatusFailed:    "failed",
	}
	for got, want := range expected {
		if string(got) != want {
			t.Errorf("PurchaseStatus constant = %q, want %q", got, want)
		}
	}
}

func TestVerificationStatusConstants(t *testing.T) {
	expected := map[VerificationStatus]string{
		VerificationStatusPending:      "PENDING",
		VerificationStatusVerified:     "VERIFIED",
		VerificationStatusRejected:     "REJECTED",
		VerificationStatusManualReview: "MANUAL_REVIEW",
	}
	for got, want := range expected {
		if string(got) != want {
			t.Errorf("VerificationStatus constant = %q, want %q", got, want)
		}
	}
}

func TestJumioStatusConstants(t *testing.T) {
	expected := map[JumioStatus]string{
		JumioStatusPending:  "PENDING",
		JumioStatusApproved: "APPROVED",
		JumioStatusRejected: "REJECTED",
		JumioStatusExpired:  "EXPIRED",
	}
	for got, want := range expected {
		if string(got) != want {
			t.Errorf("JumioStatus constant = %q, want %q", got, want)
		}
	}
}

func TestPermissionTypeConstants(t *testing.T) {
	expected := map[PermissionType]string{
		PermissionTypeAlways:  "always",
		PermissionTypeRequest: "request",
		PermissionTypeNever:   "never",
	}
	for got, want := range expected {
		if string(got) != want {
			t.Errorf("PermissionType constant = %q, want %q", got, want)
		}
	}
}

func TestHapticCommandTypeConstants(t *testing.T) {
	expected := map[HapticCommandType]string{
		HapticCommandVibrate: "vibrate",
		HapticCommandRotate:  "rotate",
		HapticCommandLinear:  "linear",
		HapticCommandStop:    "stop",
		HapticCommandPattern: "pattern",
	}
	for got, want := range expected {
		if string(got) != want {
			t.Errorf("HapticCommandType constant = %q, want %q", got, want)
		}
	}
}

func TestSessionStatusConstants(t *testing.T) {
	expected := map[SessionStatus]string{
		SessionStatusActive:  "active",
		SessionStatusEnded:   "ended",
		SessionStatusExpired: "expired",
	}
	for got, want := range expected {
		if string(got) != want {
			t.Errorf("SessionStatus constant = %q, want %q", got, want)
		}
	}
}

func TestDeviceTypeConstants(t *testing.T) {
	expected := map[DeviceType]string{
		DeviceTypeVR:     "vr",
		DeviceTypeMobile: "mobile",
		DeviceTypeWeb:    "web",
	}
	for got, want := range expected {
		if string(got) != want {
			t.Errorf("DeviceType constant = %q, want %q", got, want)
		}
	}
}

func TestPayoutStatusConstants(t *testing.T) {
	expected := map[PayoutStatus]string{
		PayoutStatusPending:    "pending",
		PayoutStatusProcessing: "processing",
		PayoutStatusPaid:       "paid",
		PayoutStatusFailed:     "failed",
	}
	for got, want := range expected {
		if string(got) != want {
			t.Errorf("PayoutStatus constant = %q, want %q", got, want)
		}
	}
}

// ---------------------------------------------------------------------------
// JSON struct tag tests for key models
// ---------------------------------------------------------------------------

func TestUserJSON_OmitsOptionalFieldsWhenNil(t *testing.T) {
	u := User{
		ID:        uuid.New(),
		Email:     "test@example.com",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	data, err := json.Marshal(u)
	if err != nil {
		t.Fatalf("failed to marshal User: %v", err)
	}
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	// Fields with omitempty should not appear when nil/zero.
	omitFields := []string{
		"display_name", "bio", "profile_photo", "birth_date", "gender",
		"looking_for", "interests", "photos", "location", "job_title",
		"company", "school", "height", "verified_at", "preferences",
	}
	for _, field := range omitFields {
		if _, ok := m[field]; ok {
			t.Errorf("field %q should be omitted when nil/zero", field)
		}
	}

	// Required fields should always appear.
	requiredFields := []string{"id", "email", "verified", "created_at", "updated_at"}
	for _, field := range requiredFields {
		if _, ok := m[field]; !ok {
			t.Errorf("field %q should always be present in JSON", field)
		}
	}
}

func TestMatchJSON_UnmatchedAtOmittedWhenNil(t *testing.T) {
	m := Match{
		ID:        uuid.New(),
		UserAID:   uuid.New(),
		UserBID:   uuid.New(),
		MatchedAt: time.Now(),
	}
	data, err := json.Marshal(m)
	if err != nil {
		t.Fatalf("failed to marshal Match: %v", err)
	}
	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	if _, ok := result["unmatched_at"]; ok {
		t.Error("unmatched_at should be omitted when nil")
	}
}

func TestConversationJSON_LastMessageAtOmittedWhenNil(t *testing.T) {
	c := Conversation{
		ID:        uuid.New(),
		MatchID:   uuid.New(),
		UserAID:   uuid.New(),
		UserBID:   uuid.New(),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	data, err := json.Marshal(c)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}
	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	if _, ok := result["last_message_at"]; ok {
		t.Error("last_message_at should be omitted when nil")
	}
}

func TestMessageJSON_DeletedAtOmitted(t *testing.T) {
	now := time.Now()
	msg := Message{
		ID:             uuid.New(),
		ConversationID: uuid.New(),
		SenderID:       uuid.New(),
		Type:           MessageTypeText,
		Content:        "Hello",
		DeletedAt:      &now,
		CreatedAt:      time.Now(),
	}
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}
	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	if _, ok := result["deleted_at"]; ok {
		t.Error("deleted_at should not appear in Message JSON (json:\"-\")")
	}
}

func TestMessageJSON_ReadAtOmittedWhenNil(t *testing.T) {
	msg := Message{
		ID:             uuid.New(),
		ConversationID: uuid.New(),
		SenderID:       uuid.New(),
		Type:           MessageTypeText,
		Content:        "Hi",
		CreatedAt:      time.Now(),
	}
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}
	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	if _, ok := result["read_at"]; ok {
		t.Error("read_at should be omitted when nil")
	}
}

// ---------------------------------------------------------------------------
// session.go struct tag tests (db tags)
// ---------------------------------------------------------------------------

func TestCompanionSessionJSON_OptionalFieldsOmitted(t *testing.T) {
	s := CompanionSession{
		ID:              uuid.New(),
		HostID:          uuid.New(),
		SessionCode:     "ABC123",
		Status:          SessionStatusActive,
		MaxParticipants: 4,
		CreatedAt:       time.Now(),
		ExpiresAt:       time.Now().Add(1 * time.Hour),
	}
	data, err := json.Marshal(s)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}
	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if _, ok := result["ended_at"]; ok {
		t.Error("ended_at should be omitted when nil")
	}

	// Required fields present.
	for _, field := range []string{"id", "host_id", "session_code", "status", "max_participants", "created_at", "expires_at"} {
		if _, ok := result[field]; !ok {
			t.Errorf("field %q should always be present in JSON", field)
		}
	}
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

func strPtr(s string) *string {
	return &s
}

func timePtr(t time.Time) *time.Time {
	return &t
}
