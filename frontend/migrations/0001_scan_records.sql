CREATE TABLE IF NOT EXISTS scan_records (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  verdict TEXT NOT NULL,
  json_payload TEXT NOT NULL,
  avatar_url TEXT,
  vibe TEXT,
  scanned_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scan_records_username_scanned_at
  ON scan_records(username, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_scan_records_score_scanned_at
  ON scan_records(score DESC, scanned_at DESC);