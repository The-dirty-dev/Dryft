-- Migration 002: Matching and Chat
-- Adds swipes tracking, unmatch support, and chat functionality

-- Swipes table
-- Tracks user swipe actions (like/pass)
CREATE TABLE swipes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swiper_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    swiped_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    direction   TEXT NOT NULL CHECK (direction IN ('like', 'pass')),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Each user can only swipe once on another user
    CONSTRAINT unique_swipe UNIQUE (swiper_id, swiped_id),
    CONSTRAINT no_self_swipe CHECK (swiper_id != swiped_id)
);

-- Add unmatch support to matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS unmatched_at TIMESTAMP WITH TIME ZONE;

-- Conversations table
-- Each match gets one conversation
CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_a_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- One conversation per match
    CONSTRAINT unique_conversation_per_match UNIQUE (match_id)
);

-- Messages table
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'gif')),
    content         TEXT NOT NULL,  -- Text content or media URL (encrypted at rest)
    read_at         TIMESTAMP WITH TIME ZONE,
    deleted_at      TIMESTAMP WITH TIME ZONE,  -- Soft delete
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for swipes
CREATE INDEX idx_swipes_swiper ON swipes(swiper_id);
CREATE INDEX idx_swipes_swiped ON swipes(swiped_id);
CREATE INDEX idx_swipes_mutual ON swipes(swiped_id, swiper_id, direction)
    WHERE direction = 'like';

-- Indexes for conversations
CREATE INDEX idx_conversations_match ON conversations(match_id);
CREATE INDEX idx_conversations_user_a ON conversations(user_a_id);
CREATE INDEX idx_conversations_user_b ON conversations(user_b_id);
CREATE INDEX idx_conversations_recent ON conversations(last_message_at DESC NULLS LAST);

-- Indexes for messages
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_unread ON messages(conversation_id, sender_id, read_at)
    WHERE read_at IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_messages_deleted ON messages(deleted_at)
    WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Function to update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_update_conversation
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();
