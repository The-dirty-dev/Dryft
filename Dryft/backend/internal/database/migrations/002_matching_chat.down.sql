-- Down Migration: Revert matching and chat schema (messages, conversations, swipes)

DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS swipes CASCADE;
