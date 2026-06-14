-- Initial bootstrap migration.
-- Product tables (offers, applications, statuses) are added in later slices.
-- This slice only needs the DB wired and a meta table to anchor schema state.

CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_meta (key, value)
VALUES ('bootstrapped_at', datetime('now'));
