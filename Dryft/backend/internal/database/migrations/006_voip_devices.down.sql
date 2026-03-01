-- Down Migration: Revert VoIP devices schema

DROP TABLE IF EXISTS voip_devices CASCADE;
