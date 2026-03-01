-- Migration: VoIP push devices for iOS
-- Created: 2026-01-12

-- ============================================================================
-- VoIP Push Devices (iOS only - APNs VoIP push)
-- ============================================================================

CREATE TABLE IF NOT EXISTS voip_devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           TEXT NOT NULL,
    bundle_id       TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint: one token per bundle per user
    UNIQUE(user_id, bundle_id)
);

CREATE INDEX idx_voip_devices_user ON voip_devices(user_id) WHERE is_active = true;
CREATE INDEX idx_voip_devices_token ON voip_devices(token);

COMMENT ON TABLE voip_devices IS 'Stores APNs VoIP push tokens for iOS devices (for incoming calls)';
