-- contact-extraction-crawlers: apply-contact columns on offers.
--
-- Additive ALTER TABLE — nullable, no backfill needed. Re-running discovery
-- populates contact on existing rows (upsert updates all columns).

ALTER TABLE offers ADD COLUMN contact_method TEXT;
ALTER TABLE offers ADD COLUMN contact_email  TEXT;
ALTER TABLE offers ADD COLUMN contact_url    TEXT;
ALTER TABLE offers ADD COLUMN contact_name   TEXT;
