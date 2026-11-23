CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  visitor TEXT NOT NULL,
  day TEXT NOT NULL,
  type TEXT NOT NULL,
  puzzle TEXT,
  category TEXT,
  difficulty TEXT,
  correct INTEGER,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS events_day_type ON events (day, type);
CREATE INDEX IF NOT EXISTS events_puzzle_type ON events (puzzle, type);
