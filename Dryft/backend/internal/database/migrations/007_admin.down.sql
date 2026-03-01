-- Down Migration: Revert admin schema (admins, user reports, admin actions) and user indexes

DROP TABLE IF EXISTS admin_actions CASCADE;
DROP TABLE IF EXISTS user_reports CASCADE;
DROP TABLE IF EXISTS admins CASCADE;

DROP INDEX IF EXISTS idx_users_is_banned;
DROP INDEX IF EXISTS idx_users_is_admin;
DROP INDEX IF EXISTS idx_users_last_active;
