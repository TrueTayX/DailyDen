CREATE TABLE IF NOT EXISTS cropweave_visitors (
  visitor TEXT PRIMARY KEY,
  first_day TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS cropweave_activity (
  event_key TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  visitor TEXT NOT NULL,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  stars INTEGER,
  coins INTEGER
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS cropweave_activity_day ON cropweave_activity (day, kind);
