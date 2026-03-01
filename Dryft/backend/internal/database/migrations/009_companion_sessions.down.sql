-- Down Migration: Revert companion sessions schema (messages, haptic permissions, participants, sessions)

DROP TABLE IF EXISTS session_messages CASCADE;
DROP TABLE IF EXISTS session_haptic_permissions CASCADE;
DROP TABLE IF EXISTS session_participants CASCADE;
DROP TABLE IF EXISTS companion_sessions CASCADE;
