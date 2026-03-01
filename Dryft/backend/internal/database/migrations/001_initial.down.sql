-- Down Migration: Revert initial schema (users, verification, matches, vr sessions)

DROP TABLE IF EXISTS vr_sessions CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS verification_attempts CASCADE;
DROP TABLE IF EXISTS users CASCADE;
