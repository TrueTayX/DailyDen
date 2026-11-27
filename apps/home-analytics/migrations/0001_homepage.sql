CREATE TABLE IF NOT EXISTS homepage_activity (
  day TEXT NOT NULL,
  visitor TEXT NOT NULL,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  events INTEGER NOT NULL CHECK (events > 0),
  PRIMARY KEY (day, visitor, source, target)
) WITHOUT ROWID;

CREATE VIEW IF NOT EXISTS homepage_daily AS
SELECT day, COUNT(DISTINCT visitor) AS unique_browsers, SUM(events) AS page_views
FROM homepage_activity WHERE target = 'visit' GROUP BY day;

CREATE VIEW IF NOT EXISTS homepage_referrals AS
SELECT day, source, COUNT(*) AS unique_browsers, SUM(events) AS page_views
FROM homepage_activity WHERE target = 'visit' GROUP BY day, source;

CREATE VIEW IF NOT EXISTS homepage_clicks AS
SELECT day, target, COUNT(DISTINCT visitor) AS unique_clickers, SUM(events) AS clicks
FROM homepage_activity WHERE target <> 'visit' GROUP BY day, target;
