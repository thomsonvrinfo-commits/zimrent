-- Migration 0009
-- Identity document table and indexes were moved into migration 0008
-- so identity_verifications can safely reference the table when created.
--
-- This migration is intentionally retained as a no-op so migration
-- numbering remains stable.

SELECT 1;