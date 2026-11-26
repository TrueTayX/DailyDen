CREATE TABLE IF NOT EXISTS cropweave_batches (
  id INTEGER PRIMARY KEY,
  hour INTEGER NOT NULL,
  events TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cropweave_batches_hour ON cropweave_batches(hour);
