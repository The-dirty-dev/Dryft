-- Migration 003: Marketplace
-- Adds creators, store items, inventory, purchases, and payouts

-- Creators table (users who sell items)
CREATE TABLE creators (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- Profile
    store_name          TEXT NOT NULL,
    description         TEXT,
    logo_url            TEXT,
    banner_url          TEXT,

    -- Stripe Connect
    stripe_account_id   TEXT UNIQUE,
    stripe_onboarded    BOOLEAN DEFAULT FALSE,
    payouts_enabled     BOOLEAN DEFAULT FALSE,

    -- Stats (denormalized for performance)
    total_sales         BIGINT DEFAULT 0,
    total_earnings      BIGINT DEFAULT 0,  -- In cents
    item_count          INTEGER DEFAULT 0,
    rating              FLOAT DEFAULT 0,
    rating_count        BIGINT DEFAULT 0,

    -- Status
    is_verified         BOOLEAN DEFAULT FALSE,
    is_featured         BOOLEAN DEFAULT FALSE,

    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Item categories
CREATE TABLE item_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    description     TEXT,
    parent_id       UUID REFERENCES item_categories(id),
    sort_order      INTEGER DEFAULT 0,
    icon_url        TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Store items
CREATE TABLE store_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id      UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    category_id     UUID REFERENCES item_categories(id),

    type            TEXT NOT NULL CHECK (type IN ('avatar', 'outfit', 'toy', 'effect', 'gesture')),
    name            TEXT NOT NULL,
    description     TEXT NOT NULL,
    price           BIGINT NOT NULL CHECK (price >= 0),  -- In cents, 0 = free
    currency        TEXT NOT NULL DEFAULT 'usd',

    -- Assets
    thumbnail_url   TEXT NOT NULL,
    preview_url     TEXT,
    asset_bundle    TEXT NOT NULL,  -- Unity asset bundle URL/key

    -- Metadata
    tags            TEXT[] DEFAULT '{}',
    attributes      JSONB DEFAULT '{}',

    -- Stats (denormalized)
    purchase_count  BIGINT DEFAULT 0,
    rating          FLOAT DEFAULT 0,
    rating_count    BIGINT DEFAULT 0,

    -- Status
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'disabled')),
    is_featured     BOOLEAN DEFAULT FALSE,
    rejection_reason TEXT,

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at      TIMESTAMP WITH TIME ZONE
);

-- Purchases
CREATE TABLE purchases (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id             UUID NOT NULL REFERENCES store_items(id),
    creator_id          UUID NOT NULL REFERENCES creators(id),

    -- Payment
    amount              BIGINT NOT NULL,  -- Amount paid in cents
    currency            TEXT NOT NULL DEFAULT 'usd',
    platform_fee        BIGINT NOT NULL,  -- Our cut
    creator_payout      BIGINT NOT NULL,  -- Creator's share
    stripe_payment_id   TEXT,

    -- Status
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
    refunded_at         TIMESTAMP WITH TIME ZONE,

    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User inventory (items owned by users)
CREATE TABLE user_inventory (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id         UUID NOT NULL REFERENCES store_items(id),
    purchase_id     UUID NOT NULL REFERENCES purchases(id),

    is_equipped     BOOLEAN DEFAULT FALSE,
    acquired_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Each user can only own one of each item
    CONSTRAINT unique_user_item UNIQUE (user_id, item_id)
);

-- Item reviews
CREATE TABLE item_reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         UUID NOT NULL REFERENCES store_items(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment         TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- One review per user per item
    CONSTRAINT unique_user_review UNIQUE (user_id, item_id)
);

-- Creator payouts
CREATE TABLE creator_payouts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id          UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,

    amount              BIGINT NOT NULL,  -- In cents
    currency            TEXT NOT NULL DEFAULT 'usd',

    -- Stripe
    stripe_transfer_id  TEXT,
    stripe_payout_id    TEXT,

    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
    paid_at             TIMESTAMP WITH TIME ZONE,
    failed_at           TIMESTAMP WITH TIME ZONE,
    fail_reason         TEXT,

    -- Period covered
    period_start        TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end          TIMESTAMP WITH TIME ZONE NOT NULL,

    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes

-- Creators
CREATE INDEX idx_creators_user ON creators(user_id);
CREATE INDEX idx_creators_stripe ON creators(stripe_account_id) WHERE stripe_account_id IS NOT NULL;
CREATE INDEX idx_creators_featured ON creators(is_featured) WHERE is_featured = true;

-- Categories
CREATE INDEX idx_categories_parent ON item_categories(parent_id);
CREATE INDEX idx_categories_slug ON item_categories(slug);

-- Store items
CREATE INDEX idx_items_creator ON store_items(creator_id);
CREATE INDEX idx_items_category ON store_items(category_id);
CREATE INDEX idx_items_type ON store_items(type);
CREATE INDEX idx_items_status ON store_items(status) WHERE status = 'approved';
CREATE INDEX idx_items_featured ON store_items(is_featured) WHERE is_featured = true AND status = 'approved';
CREATE INDEX idx_items_price ON store_items(price) WHERE status = 'approved';
CREATE INDEX idx_items_rating ON store_items(rating DESC) WHERE status = 'approved';
CREATE INDEX idx_items_purchases ON store_items(purchase_count DESC) WHERE status = 'approved';
CREATE INDEX idx_items_tags ON store_items USING GIN(tags);
CREATE INDEX idx_items_deleted ON store_items(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_items_search ON store_items USING GIN(to_tsvector('english', name || ' ' || description));

-- Purchases
CREATE INDEX idx_purchases_buyer ON purchases(buyer_id);
CREATE INDEX idx_purchases_item ON purchases(item_id);
CREATE INDEX idx_purchases_creator ON purchases(creator_id);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_purchases_stripe ON purchases(stripe_payment_id);

-- Inventory
CREATE INDEX idx_inventory_user ON user_inventory(user_id);
CREATE INDEX idx_inventory_item ON user_inventory(item_id);
CREATE INDEX idx_inventory_equipped ON user_inventory(user_id, is_equipped) WHERE is_equipped = true;

-- Reviews
CREATE INDEX idx_reviews_item ON item_reviews(item_id);
CREATE INDEX idx_reviews_user ON item_reviews(user_id);

-- Payouts
CREATE INDEX idx_payouts_creator ON creator_payouts(creator_id);
CREATE INDEX idx_payouts_status ON creator_payouts(status);
CREATE INDEX idx_payouts_period ON creator_payouts(period_start, period_end);

-- Triggers

CREATE TRIGGER creators_updated_at
    BEFORE UPDATE ON creators
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER store_items_updated_at
    BEFORE UPDATE ON store_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER item_reviews_updated_at
    BEFORE UPDATE ON item_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Function to update item stats after purchase
CREATE OR REPLACE FUNCTION update_item_purchase_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
        UPDATE store_items SET purchase_count = purchase_count + 1 WHERE id = NEW.item_id;
        UPDATE creators SET total_sales = total_sales + 1, total_earnings = total_earnings + NEW.creator_payout WHERE id = NEW.creator_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchases_update_stats
    AFTER INSERT OR UPDATE ON purchases
    FOR EACH ROW
    EXECUTE FUNCTION update_item_purchase_count();

-- Function to update item rating after review
CREATE OR REPLACE FUNCTION update_item_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE store_items
    SET rating = (SELECT AVG(rating)::FLOAT FROM item_reviews WHERE item_id = NEW.item_id),
        rating_count = (SELECT COUNT(*) FROM item_reviews WHERE item_id = NEW.item_id)
    WHERE id = NEW.item_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_update_rating
    AFTER INSERT OR UPDATE OR DELETE ON item_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_item_rating();

-- Insert default categories
INSERT INTO item_categories (name, slug, description, sort_order) VALUES
    ('Avatars', 'avatars', 'Full avatar models', 1),
    ('Outfits', 'outfits', 'Clothing and accessories', 2),
    ('Toys', 'toys', 'Interactive toys and devices', 3),
    ('Effects', 'effects', 'Visual effects and particles', 4),
    ('Gestures', 'gestures', 'Animations and emotes', 5);
