-- Down Migration: Revert calls schema (ice servers, call history)

DROP TABLE IF EXISTS ice_servers CASCADE;
DROP TABLE IF EXISTS call_history CASCADE;
