-- Migration: Push notifications and extended profile fields
-- Created: 2026-01-11

-- ============================================================================
-- Push Notification Devices
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_devices (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           TEXT NOT NULL,
    platform        TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    device_id       TEXT NOT NULL,
    app_version     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint: one token per device per user
    UNIQUE(user_id, device_id)
);

CREATE INDEX idx_push_devices_user ON push_devices(user_id) WHERE is_active = true;
CREATE INDEX idx_push_devices_token ON push_devices(token);

-- ============================================================================
-- Notification History
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_history (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    data            JSONB DEFAULT '{}',
    read_at         TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_history_user ON notification_history(user_id, created_at DESC);
CREATE INDEX idx_notification_history_unread ON notification_history(user_id) WHERE read_at IS NULL;

-- ============================================================================
-- Extended User Profile Fields
-- ============================================================================

-- Add new columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS looking_for JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS location JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS school TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS height INTEGER;

-- Add index for location-based queries
CREATE INDEX IF NOT EXISTS idx_users_location ON users USING GIN (location);

-- Add index for discover queries
CREATE INDEX IF NOT EXISTS idx_users_discover ON users(verified, deleted_at)
    WHERE verified = true AND deleted_at IS NULL;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE push_devices IS 'Stores FCM/APNs tokens for push notifications';
COMMENT ON TABLE notification_history IS 'Stores notification history for users';
COMMENT ON COLUMN users.looking_for IS 'Array of genders the user is interested in';
COMMENT ON COLUMN users.interests IS 'Array of user interests/hobbies';
COMMENT ON COLUMN users.photos IS 'Array of S3 keys for gallery photos';
COMMENT ON COLUMN users.location IS 'JSON with latitude, longitude, city, country';
COMMENT ON COLUMN users.height IS 'Height in centimeters';
