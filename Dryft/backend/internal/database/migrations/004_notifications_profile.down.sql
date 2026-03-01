-- Down Migration: Revert notifications, push devices, and profile indexes

DROP TABLE IF EXISTS notification_history CASCADE;
DROP TABLE IF EXISTS push_devices CASCADE;

DROP INDEX IF EXISTS idx_users_location;
DROP INDEX IF EXISTS idx_users_discover;
