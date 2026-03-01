-- Down Migration: Revert marketplace schema (creators, categories, items, purchases, inventory, reviews, payouts)

DROP TABLE IF EXISTS creator_payouts CASCADE;
DROP TABLE IF EXISTS item_reviews CASCADE;
DROP TABLE IF EXISTS user_inventory CASCADE;
DROP TABLE IF EXISTS purchases CASCADE;
DROP TABLE IF EXISTS store_items CASCADE;
DROP TABLE IF EXISTS item_categories CASCADE;
DROP TABLE IF EXISTS creators CASCADE;
