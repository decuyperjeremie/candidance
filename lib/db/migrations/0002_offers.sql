-- Slice 2 (job-discovery): store aggregated, de-duplicated, scored offers.
--
-- offers        : one row per distinct job (de-duped across sources by dedup_key).
-- offer_sources : provenance — every source that surfaced an offer, with its URL.
-- crawl_runs    : bookkeeping for each on-demand discovery pass (the run summary).

CREATE TABLE IF NOT EXISTS offers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Normalised fuzzy identity (company|title|city). Same job -> same key.
  dedup_key       TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  company         TEXT,
  location        TEXT,
  department_code TEXT,            -- IDF: 75/77/78/91/92/93/94/95
  contract_type   TEXT,
  description     TEXT,
  posted_at       TEXT,            -- source-provided posting date (ISO-ish), if any
  -- Relevance vs the communication facet of the CandidateProfile.
  score           INTEGER NOT NULL DEFAULT 0,
  score_rationale TEXT,
  first_seen_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_offers_score ON offers (score DESC);

CREATE TABLE IF NOT EXISTS offer_sources (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id        INTEGER NOT NULL REFERENCES offers (id) ON DELETE CASCADE,
  source          TEXT NOT NULL,   -- connector name, e.g. "france-travail"
  source_local_id TEXT NOT NULL,   -- the offer's id within that source
  url             TEXT,            -- original posting URL on that source
  seen_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source, source_local_id)
);

CREATE INDEX IF NOT EXISTS idx_offer_sources_offer ON offer_sources (offer_id);

CREATE TABLE IF NOT EXISTS crawl_runs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at       TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at      TEXT,
  criteria         TEXT,           -- JSON: keywords + zone used for the pass
  per_source       TEXT,           -- JSON: { "france-travail": 42, ... } or error reasons
  duplicates_merged INTEGER NOT NULL DEFAULT 0,
  total_stored     INTEGER NOT NULL DEFAULT 0
);
