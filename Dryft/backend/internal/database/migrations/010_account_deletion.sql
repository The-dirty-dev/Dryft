-- Account deletion requests table (SEC-011)
-- Stores pending account deletion requests with time-limited confirmation tokens.
CREATE TABLE account_deletion_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           TEXT NOT NULL UNIQUE,
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    confirmed_at    TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_deletion_requests_user ON account_deletion_requests(user_id);
CREATE INDEX idx_deletion_requests_token ON account_deletion_requests(token);
CREATE INDEX idx_deletion_requests_expires ON account_deletion_requests(expires_at)
    WHERE confirmed_at IS NULL;
