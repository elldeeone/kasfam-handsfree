-- Adds published tweet linkage and engagement metrics tracking

ALTER TABLE tweets ADD COLUMN publishedTweetId TEXT;
ALTER TABLE tweets ADD COLUMN likesCount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tweets ADD COLUMN retweetsCount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tweets ADD COLUMN repliesCount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tweets ADD COLUMN quotesCount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tweets ADD COLUMN viewsCount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tweets ADD COLUMN lastMetricsUpdate TEXT;

CREATE TABLE IF NOT EXISTS tweet_metrics_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tweetId TEXT NOT NULL,
  capturedAt TEXT NOT NULL DEFAULT (datetime('now')),
  likesCount INTEGER NOT NULL DEFAULT 0,
  retweetsCount INTEGER NOT NULL DEFAULT 0,
  repliesCount INTEGER NOT NULL DEFAULT 0,
  quotesCount INTEGER NOT NULL DEFAULT 0,
  viewsCount INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tweet_metrics_snapshots_tweetId
  ON tweet_metrics_snapshots(tweetId);
