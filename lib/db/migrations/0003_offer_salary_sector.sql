-- Slice 2 refinement: richer extraction for filtering + freshness display.
--   salary : human-readable pay string from the source (e.g. France Travail
--            `salaire.libelle`), when available — extracted, never invented.
--   sector : source activity/NAF code (France Travail `secteurActivite`), used
--            to exclude hospitality (NAF 55/56: restauration/hébergement).
-- (posted_at already exists from 0002 and carries the publication date.)

ALTER TABLE offers ADD COLUMN salary TEXT;
ALTER TABLE offers ADD COLUMN sector TEXT;
