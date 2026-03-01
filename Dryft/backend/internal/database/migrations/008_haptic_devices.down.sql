-- Down Migration: Revert haptic devices schema (patterns, command log, permissions, devices)

DROP TABLE IF EXISTS haptic_patterns CASCADE;
DROP TABLE IF EXISTS haptic_command_log CASCADE;
DROP TABLE IF EXISTS haptic_permissions CASCADE;
DROP TABLE IF EXISTS haptic_devices CASCADE;
