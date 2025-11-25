-- Migration: make approved column nullable to support tweets without model decision
-- Run with: sqlite3 path/to/db.sqlite < migrations/002_make_approved_nullable.sql

-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table
BEGIN TRANSACTION;

-- create new table with nullable approved
CREATE TABLE tweets_new (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  quote TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  approved INTEGER DEFAULT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  humanDecision TEXT DEFAULT NULL CHECK(humanDecision IN ('APPROVED','REJECTED'))
);

-- copy data from old table
INSERT INTO tweets_new (id, text, quote, url, approved, createdAt, humanDecision)
SELECT id, text, quote, url, approved, createdAt, humanDecision FROM tweets;

-- drop old table and rename new one
DROP TABLE tweets;
ALTER TABLE tweets_new RENAME TO tweets;

-- recreate index
CREATE UNIQUE INDEX IF NOT EXISTS idx_tweets_id ON tweets(id);

COMMIT;

