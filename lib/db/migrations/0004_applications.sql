-- Slice 3 (application-generation): persist generated applications.
--
-- One row per offer (offer_id UNIQUE -> regenerating upserts in place). Files
-- are NOT stored as blobs; they are re-rendered on demand from cv_json +
-- letter_text, so rendering can be tweaked without re-running the LLM.

CREATE TABLE IF NOT EXISTS applications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id    INTEGER NOT NULL UNIQUE REFERENCES offers (id) ON DELETE CASCADE,
  cv_json     TEXT NOT NULL,   -- ApplicationContent.cv (validated JSON)
  letter_text TEXT NOT NULL,   -- ApplicationContent.letter (JSON: paragraphs + context)
  provider    TEXT,            -- LLM provider used (e.g. "claude-code")
  model       TEXT,            -- model id/alias used
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
