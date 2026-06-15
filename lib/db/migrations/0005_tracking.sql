-- Slice 4b (email-and-tracking): per-application status + event history.
--
-- Status lives ON the application row (one status per application); the history
-- of changes/relances/notes gets its own table. An offer with no application
-- row is treated as 'à_traiter' at read time (no row is written for it).

ALTER TABLE applications ADD COLUMN status TEXT NOT NULL DEFAULT 'à_traiter';
ALTER TABLE applications ADD COLUMN status_updated_at TEXT;

CREATE TABLE IF NOT EXISTS application_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id   INTEGER NOT NULL REFERENCES offers (id) ON DELETE CASCADE,
  type       TEXT NOT NULL,   -- 'status' | 'relance' | 'note'
  note       TEXT,            -- the new status value (type='status') or free text
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_application_events_offer
  ON application_events (offer_id, created_at);
