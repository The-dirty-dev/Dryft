-- Companion sessions allow mobile/web users to interact with VR users

-- Sessions table
CREATE TABLE companion_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_code VARCHAR(6) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, ended, expired
    max_participants INT NOT NULL DEFAULT 5,

    -- VR state tracking
    vr_device_type VARCHAR(50), -- "quest3", "quest_pro", etc.
    vr_room VARCHAR(50), -- current room in VR

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_status CHECK (status IN ('active', 'ended', 'expired'))
);

-- Session participants
CREATE TABLE session_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES companion_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    device_type VARCHAR(20) NOT NULL, -- "vr", "mobile", "web"
    is_host BOOLEAN NOT NULL DEFAULT FALSE,

    -- Timestamps
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,

    UNIQUE(session_id, user_id)
);

-- Session haptic permissions (who can control whose device)
CREATE TABLE session_haptic_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES companion_sessions(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    controller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_type VARCHAR(20) NOT NULL DEFAULT 'request', -- always, request, never
    max_intensity DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    UNIQUE(session_id, owner_id, controller_id),
    CONSTRAINT valid_permission_type CHECK (permission_type IN ('always', 'request', 'never')),
    CONSTRAINT valid_intensity CHECK (max_intensity >= 0 AND max_intensity <= 1)
);

-- Session chat messages
CREATE TABLE session_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES companion_sessions(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text', -- text, reaction, system
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sessions_code ON companion_sessions(session_code) WHERE status = 'active';
CREATE INDEX idx_sessions_host ON companion_sessions(host_id, status);
CREATE INDEX idx_sessions_expires ON companion_sessions(expires_at) WHERE status = 'active';
CREATE INDEX idx_participants_session ON session_participants(session_id) WHERE left_at IS NULL;
CREATE INDEX idx_participants_user ON session_participants(user_id, session_id);
CREATE INDEX idx_session_messages_session ON session_messages(session_id, created_at DESC);
