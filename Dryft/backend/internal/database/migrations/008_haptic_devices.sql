-- Haptic Device Management
-- Enables buttplug.io/Intiface integration for remote toy control between matched users

-- User's connected haptic devices (synced from Intiface Central)
CREATE TABLE haptic_devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Device identification
    device_index    INTEGER NOT NULL,           -- Buttplug device index (session-specific)
    device_name     TEXT NOT NULL,              -- e.g., "Lovense Lush 3"
    device_address  TEXT,                       -- Bluetooth address for reconnection

    -- Device capabilities (from Buttplug)
    can_vibrate     BOOLEAN DEFAULT FALSE,
    can_rotate      BOOLEAN DEFAULT FALSE,
    can_linear      BOOLEAN DEFAULT FALSE,      -- Linear actuators (strokers)
    can_battery     BOOLEAN DEFAULT FALSE,
    vibrate_count   INTEGER DEFAULT 0,          -- Number of vibration motors
    rotate_count    INTEGER DEFAULT 0,
    linear_count    INTEGER DEFAULT 0,

    -- User preferences
    display_name    TEXT,                       -- User's custom name for the device
    is_primary      BOOLEAN DEFAULT FALSE,      -- Primary device for this user
    max_intensity   FLOAT DEFAULT 1.0,          -- User's max intensity limit (0-1)

    -- Status
    last_connected  TIMESTAMP WITH TIME ZONE,

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, device_address)
);

-- Haptic permissions: who can control whose devices
CREATE TABLE haptic_permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The user granting permission (device owner)
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- The user receiving permission (controller)
    controller_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Match context (permissions are scoped to a match)
    match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,

    -- Permission settings
    permission_type TEXT NOT NULL DEFAULT 'request',  -- 'always', 'request', 'never'
    max_intensity   FLOAT DEFAULT 1.0,                -- Max intensity this user can send (0-1)

    -- Time-limited permissions
    expires_at      TIMESTAMP WITH TIME ZONE,         -- NULL = no expiration

    -- Tracking
    granted_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at      TIMESTAMP WITH TIME ZONE,

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- One permission record per match per direction
    UNIQUE(owner_id, controller_id, match_id),

    -- Can't grant permission to yourself
    CONSTRAINT no_self_permission CHECK (owner_id != controller_id)
);

-- Haptic command log for debugging and safety auditing
-- LEGAL NOTE: This log helps identify harassment patterns
CREATE TABLE haptic_command_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who sent the command
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Who received the command
    receiver_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Context
    match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    call_id         UUID,                             -- If during a call

    -- Command details
    command_type    TEXT NOT NULL,                    -- 'vibrate', 'rotate', 'linear', 'stop'
    intensity       FLOAT,                            -- 0-1
    duration_ms     INTEGER,                          -- Command duration
    pattern         TEXT,                             -- Pattern name if any

    -- Status
    was_delivered   BOOLEAN DEFAULT FALSE,
    was_blocked     BOOLEAN DEFAULT FALSE,            -- If permission denied

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Haptic patterns (user-created or marketplace items)
CREATE TABLE haptic_patterns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Creator (NULL for system patterns)
    creator_id      UUID REFERENCES users(id) ON DELETE SET NULL,

    -- If this is a marketplace item
    store_item_id   UUID REFERENCES store_items(id) ON DELETE CASCADE,

    -- Pattern definition
    name            TEXT NOT NULL,
    description     TEXT,
    is_public       BOOLEAN DEFAULT FALSE,

    -- Pattern data: array of {time_ms, intensity, motor_index} objects
    pattern_data    JSONB NOT NULL,

    -- Duration in milliseconds
    duration_ms     INTEGER NOT NULL,

    -- Stats
    use_count       INTEGER DEFAULT 0,

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_haptic_devices_user ON haptic_devices(user_id);
CREATE INDEX idx_haptic_devices_primary ON haptic_devices(user_id, is_primary) WHERE is_primary = true;

CREATE INDEX idx_haptic_permissions_owner ON haptic_permissions(owner_id);
CREATE INDEX idx_haptic_permissions_controller ON haptic_permissions(controller_id);
CREATE INDEX idx_haptic_permissions_match ON haptic_permissions(match_id);
CREATE INDEX idx_haptic_permissions_active ON haptic_permissions(owner_id, controller_id)
    WHERE revoked_at IS NULL;

CREATE INDEX idx_haptic_command_log_sender ON haptic_command_log(sender_id, created_at DESC);
CREATE INDEX idx_haptic_command_log_receiver ON haptic_command_log(receiver_id, created_at DESC);
CREATE INDEX idx_haptic_command_log_match ON haptic_command_log(match_id, created_at DESC);

CREATE INDEX idx_haptic_patterns_creator ON haptic_patterns(creator_id);
CREATE INDEX idx_haptic_patterns_public ON haptic_patterns(is_public) WHERE is_public = true;

-- Triggers
CREATE TRIGGER haptic_devices_updated_at
    BEFORE UPDATE ON haptic_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER haptic_permissions_updated_at
    BEFORE UPDATE ON haptic_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER haptic_patterns_updated_at
    BEFORE UPDATE ON haptic_patterns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
