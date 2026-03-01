-- Drift Database Schema
-- LEGAL NOTE: This schema stores age verification data required for compliance
-- with adult content regulations. Data retention and deletion policies must
-- comply with GDPR, CCPA, and applicable local laws.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
-- Stores basic user profile information
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,

    display_name    TEXT,
    bio             TEXT,
    profile_photo   TEXT,  -- S3 key, content encrypted at rest

    -- Verification status
    verified        BOOLEAN DEFAULT FALSE,
    verified_at     TIMESTAMP WITH TIME ZONE,

    -- User preferences (matching, privacy, etc.)
    preferences     JSONB DEFAULT '{}',

    -- Soft delete support
    deleted_at      TIMESTAMP WITH TIME ZONE,

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Verification attempts table
-- LEGAL NOTE: Audit trail for age verification. Retain according to
-- regulatory requirements (typically 7 years for financial records).
CREATE TABLE verification_attempts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Stripe card verification
    -- LEGAL NOTE: We store customer ID only, never card details
    stripe_customer_id      TEXT,
    stripe_verified         BOOLEAN DEFAULT FALSE,
    stripe_verified_at      TIMESTAMP WITH TIME ZONE,
    stripe_card_last4       TEXT,  -- Last 4 digits only, for display
    stripe_card_brand       TEXT,  -- visa, mastercard, etc.

    -- Jumio ID verification
    -- LEGAL NOTE: Jumio handles PII storage. We store references only.
    jumio_scan_ref          TEXT,  -- Jumio's scan reference ID
    jumio_status            TEXT DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED, EXPIRED
    jumio_verified_at       TIMESTAMP WITH TIME ZONE,
    jumio_dob               DATE,  -- Extracted DOB for age calculation
    jumio_document_type     TEXT,  -- PASSPORT, DRIVERS_LICENSE, ID_CARD
    jumio_document_country  TEXT,  -- ISO 3166-1 alpha-3
    jumio_rejection_reason  TEXT,

    -- Face match verification
    -- LEGAL NOTE: We compare Jumio selfie against profile photo
    -- to prevent identity fraud. Scores stored for audit.
    face_match_score        FLOAT,
    face_match_passed       BOOLEAN,
    face_match_method       TEXT,  -- 'jumio' or 'rekognition'

    -- Overall verification status
    overall_status          TEXT DEFAULT 'PENDING',  -- PENDING, VERIFIED, REJECTED, MANUAL_REVIEW
    rejection_reason        TEXT,
    reviewed_by             UUID REFERENCES users(id),  -- Admin who did manual review
    reviewed_at             TIMESTAMP WITH TIME ZONE,

    -- Retry tracking
    retry_count             INTEGER DEFAULT 0,
    last_retry_at           TIMESTAMP WITH TIME ZONE,
    retry_cooldown_until    TIMESTAMP WITH TIME ZONE,

    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Matches table
CREATE TABLE matches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    matched_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure users can only match once (in either direction)
    CONSTRAINT unique_match UNIQUE (user_a, user_b),
    CONSTRAINT no_self_match CHECK (user_a != user_b),
    CONSTRAINT ordered_users CHECK (user_a < user_b)  -- Canonical ordering
);

-- VR Sessions table
-- Tracks when users enter VR together
CREATE TABLE vr_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    space_type      TEXT NOT NULL,  -- 'public_lounge', 'private_booth'

    -- Session timing
    started_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at        TIMESTAMP WITH TIME ZONE,

    -- Encrypted session key for E2E haptic communication
    -- LEGAL NOTE: This enables end-to-end encrypted haptic data
    -- between consenting adults. Server cannot decrypt.
    session_key_encrypted   BYTEA,

    -- Normcore room info
    normcore_room_name      TEXT,

    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_verified ON users(verified) WHERE verified = true;
CREATE INDEX idx_users_deleted ON users(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_verification_user ON verification_attempts(user_id);
CREATE INDEX idx_verification_status ON verification_attempts(overall_status);
CREATE INDEX idx_verification_pending ON verification_attempts(overall_status)
    WHERE overall_status IN ('PENDING', 'MANUAL_REVIEW');
CREATE INDEX idx_verification_jumio_ref ON verification_attempts(jumio_scan_ref);

CREATE INDEX idx_matches_user_a ON matches(user_a);
CREATE INDEX idx_matches_user_b ON matches(user_b);

CREATE INDEX idx_vr_sessions_users ON vr_sessions(user_a, user_b);
CREATE INDEX idx_vr_sessions_active ON vr_sessions(ended_at) WHERE ended_at IS NULL;

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER verification_attempts_updated_at
    BEFORE UPDATE ON verification_attempts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
