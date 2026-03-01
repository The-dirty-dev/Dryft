-- Migration: Video/Voice Call History
-- Created: 2026-01-11

-- ============================================================================
-- Call History
-- ============================================================================

CREATE TABLE IF NOT EXISTS call_history (
    id              UUID PRIMARY KEY,
    caller_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    callee_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id        UUID REFERENCES matches(id) ON DELETE SET NULL,
    video_enabled   BOOLEAN DEFAULT FALSE,
    state           TEXT NOT NULL CHECK (state IN ('ringing', 'connected', 'ended', 'missed', 'rejected')),
    started_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    answered_at     TIMESTAMP WITH TIME ZONE,
    ended_at        TIMESTAMP WITH TIME ZONE,
    duration_secs   INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN answered_at IS NOT NULL AND ended_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (ended_at - answered_at))::INTEGER
            ELSE 0
        END
    ) STORED,
    end_reason      TEXT, -- 'completed', 'no_answer', 'rejected', 'connection_failed'
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fetching user's call history
CREATE INDEX idx_call_history_caller ON call_history(caller_id, started_at DESC);
CREATE INDEX idx_call_history_callee ON call_history(callee_id, started_at DESC);
CREATE INDEX idx_call_history_match ON call_history(match_id, started_at DESC);

-- ============================================================================
-- ICE Server Configuration (TURN/STUN)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ice_servers (
    id              SERIAL PRIMARY KEY,
    url             TEXT NOT NULL,
    username        TEXT,
    credential      TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    priority        INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default STUN servers
INSERT INTO ice_servers (url, priority) VALUES
    ('stun:stun.l.google.com:19302', 10),
    ('stun:stun1.l.google.com:19302', 9),
    ('stun:stun2.l.google.com:19302', 8)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE call_history IS 'Stores video/voice call history between matched users';
COMMENT ON COLUMN call_history.duration_secs IS 'Call duration in seconds, auto-calculated';
COMMENT ON TABLE ice_servers IS 'TURN/STUN server configuration for WebRTC';
