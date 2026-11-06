-- Persist every scan (so share links work for all tones) while keeping the
-- leaderboard and 24h cache scoped to the default honest mode.
ALTER TABLE scan_records ADD COLUMN mode TEXT NOT NULL DEFAULT 'honest';

CREATE INDEX IF NOT EXISTS idx_scan_records_username_mode_scanned_at
  ON scan_records(username, mode, scanned_at DESC);
