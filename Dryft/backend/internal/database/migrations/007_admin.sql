-- 007_admin.sql
-- Admin dashboard tables for moderation and manual review

-- Add admin and ban fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP;

-- Admin actions audit log
CREATE TABLE IF NOT EXISTS admin_actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id        UUID NOT NULL REFERENCES users(id),
    action_type     TEXT NOT NULL,  -- 'verify_approve', 'verify_reject', 'ban_user', 'unban_user', 'review_report'
    target_type     TEXT NOT NULL,  -- 'verification', 'user', 'report'
    target_id       UUID NOT NULL,  -- ID of the target (verification, user, or report)
    notes           TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMP DEFAULT NOW()
);

-- User reports for content/behavior moderation
CREATE TABLE IF NOT EXISTS user_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id     UUID NOT NULL REFERENCES users(id),
    reported_user_id UUID NOT NULL REFERENCES users(id),
    reason          TEXT NOT NULL,  -- 'harassment', 'fake_profile', 'inappropriate_content', 'spam', 'underage', 'other'
    description     TEXT,
    evidence_urls   TEXT[],         -- S3 keys for screenshots, etc.

    -- Review status
    status          TEXT DEFAULT 'pending',  -- 'pending', 'reviewed', 'dismissed'
    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMP,
    action_taken    TEXT,           -- 'dismiss', 'warn', 'ban'

    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Admin users table (for role management)
CREATE TABLE IF NOT EXISTS admins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE NOT NULL REFERENCES users(id),
    role            TEXT DEFAULT 'moderator',  -- 'moderator', 'admin', 'super_admin'
    permissions     JSONB DEFAULT '{}',
    created_at      TIMESTAMP DEFAULT NOW(),
    created_by      UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON admin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported_user ON user_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter ON user_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_created ON user_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned) WHERE is_banned = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at DESC);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_reports
DROP TRIGGER IF EXISTS user_reports_updated_at ON user_reports;
CREATE TRIGGER user_reports_updated_at
    BEFORE UPDATE ON user_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_user_reports_updated_at();
