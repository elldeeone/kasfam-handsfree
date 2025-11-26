import Database, { Database as SqliteDatabase } from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

export type HumanDecision = "APPROVED" | "REJECTED";

export type TweetRecord = {
  id: string;
  text: string;
  quote: string;
  url: string;
  approved: boolean;
  score: number;
  createdAt: string;
  humanDecision: HumanDecision | null;
  publishedTweetId: string | null;
  likesCount: number;
  retweetsCount: number;
  repliesCount: number;
  quotesCount: number;
  viewsCount: number;
  lastMetricsUpdate: string | null;
};

export type TweetDecisionInput = {
  id: string;
  text: string;
  quote: string;
  url: string;
  approved: boolean;
  score: number;
};

export type TweetFilters = {
  approved?: boolean;
  humanDecision?: HumanDecision | "UNSET";
};

export type PaginationOptions = {
  page?: number;
  pageSize?: number;
};

type NormalizedPagination = {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function resolveDbPath() {
  const inputPath = process.env.SQLITE_DB_PATH || "data/app.db";
  const resolved = path.resolve(inputPath);
  mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

function initDb(): SqliteDatabase {
  const db = new Database(resolveDbPath());
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS tweets (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      quote TEXT NOT NULL,
      url TEXT NOT NULL,
      approved INTEGER NOT NULL DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      humanDecision TEXT DEFAULT NULL CHECK(humanDecision IN ('APPROVED','REJECTED')),
      publishedTweetId TEXT,
      likesCount INTEGER NOT NULL DEFAULT 0,
      retweetsCount INTEGER NOT NULL DEFAULT 0,
      repliesCount INTEGER NOT NULL DEFAULT 0,
      quotesCount INTEGER NOT NULL DEFAULT 0,
      viewsCount INTEGER NOT NULL DEFAULT 0,
      lastMetricsUpdate TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tweets_id ON tweets(id);
  `);

  db.exec(`
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
  `);
  return db;
}

export function createTweetStore() {
  const db = initDb();
  ensureMetricsColumns(db);

  const upsert = db.prepare(`
    INSERT INTO tweets (id, text, quote, url, approved, score)
    VALUES (@id, @text, @quote, @url, @approved, @score)
    ON CONFLICT(id) DO UPDATE SET
      text = excluded.text,
      quote = excluded.quote,
      url = excluded.url,
      approved = excluded.approved,
      score = excluded.score
  `);

  return {
    save(decision: TweetDecisionInput) {
      upsert.run({
        ...decision,
        approved: decision.approved ? 1 : 0,
      });
    },
    list(filters: TweetFilters = {}, pagination?: PaginationOptions) {
      const normalizedPagination = normalizePagination(pagination);
      const where: string[] = [];
      const params: Record<string, unknown> = {};

      if (typeof filters.approved === "boolean") {
        where.push("approved = @approved");
        params.approved = filters.approved ? 1 : 0;
      }

      if (
        filters.humanDecision === "APPROVED" ||
        filters.humanDecision === "REJECTED"
      ) {
        where.push("humanDecision = @humanDecision");
        params.humanDecision = filters.humanDecision;
      } else if (filters.humanDecision === "UNSET") {
        where.push("humanDecision IS NULL");
      }

      const baseQuery = `
        FROM tweets
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      `;

      const sql = `
        SELECT id, text, quote, url, approved, score, createdAt, humanDecision,
               publishedTweetId, likesCount, retweetsCount, repliesCount,
               quotesCount, viewsCount, lastMetricsUpdate
        ${baseQuery}
        ORDER BY score DESC, datetime(createdAt) DESC
        LIMIT @limit OFFSET @offset
      `;

      const rows = db.prepare(sql).all({
        ...params,
        limit: normalizedPagination.limit,
        offset: normalizedPagination.offset,
      }) as Array<{
        id: string;
        text: string;
        quote: string;
        url: string;
        approved: number;
        score: number;
        createdAt: string;
        humanDecision: HumanDecision | null;
        publishedTweetId: string | null;
        likesCount: number;
        retweetsCount: number;
        repliesCount: number;
        quotesCount: number;
        viewsCount: number;
        lastMetricsUpdate: string | null;
      }>;

      const totalRow = db
        .prepare(`SELECT COUNT(*) as total ${baseQuery}`)
        .get(params) as { total: number };

      const tweets = rows.map((row) => ({
        ...row,
        approved: Boolean(row.approved),
        score: Number(row.score) || 0,
        humanDecision: row.humanDecision ?? null,
        publishedTweetId: row.publishedTweetId ?? null,
        likesCount: Number(row.likesCount) || 0,
        retweetsCount: Number(row.retweetsCount) || 0,
        repliesCount: Number(row.repliesCount) || 0,
        quotesCount: Number(row.quotesCount) || 0,
        viewsCount: Number(row.viewsCount) || 0,
        lastMetricsUpdate: row.lastMetricsUpdate ?? null,
      }));

      return {
        tweets,
        total: totalRow?.total ?? 0,
        page: normalizedPagination.page,
        pageSize: normalizedPagination.pageSize,
      };
    },
    get(id: string): TweetRecord | null {
      const row = db
        .prepare(
          `
        SELECT id, text, quote, url, approved, score, createdAt, humanDecision,
               publishedTweetId, likesCount, retweetsCount, repliesCount,
               quotesCount, viewsCount, lastMetricsUpdate
        FROM tweets
        WHERE id = @id
      `
        )
        .get({ id }) as
        | {
            id: string;
            text: string;
            quote: string;
            url: string;
            approved: number;
            score: number;
            createdAt: string;
            humanDecision: HumanDecision | null;
            publishedTweetId: string | null;
            likesCount: number;
            retweetsCount: number;
            repliesCount: number;
            quotesCount: number;
            viewsCount: number;
            lastMetricsUpdate: string | null;
          }
        | undefined;

      if (!row) {
        return null;
      }

      return {
        ...row,
        approved: Boolean(row.approved),
        score: Number(row.score) || 0,
        humanDecision: row.humanDecision ?? null,
        publishedTweetId: row.publishedTweetId ?? null,
        likesCount: Number(row.likesCount) || 0,
        retweetsCount: Number(row.retweetsCount) || 0,
        repliesCount: Number(row.repliesCount) || 0,
        quotesCount: Number(row.quotesCount) || 0,
        viewsCount: Number(row.viewsCount) || 0,
        lastMetricsUpdate: row.lastMetricsUpdate ?? null,
      };
    },
    updateHumanDecision(
      id: string,
      decision?: HumanDecision | null,
      publishedTweetId?: string | null
    ) {
      const sets: string[] = [];
      const params: Record<string, unknown> = { id };

      if (decision !== undefined) {
        sets.push("humanDecision = @decision");
        params.decision = decision;
      }

      if (publishedTweetId !== undefined) {
        sets.push("publishedTweetId = @publishedTweetId");
        params.publishedTweetId = publishedTweetId;
      }

      if (sets.length === 0) {
        return;
      }

      db.prepare(
        `
        UPDATE tweets
        SET ${sets.join(", ")}
        WHERE id = @id
      `
      ).run(params);
    },
    has(id: string): boolean {
      const row = db.prepare("SELECT 1 FROM tweets WHERE id = @id").get({ id });
      return !!row;
    },
    close() {
      db.close();
    },
  };
}

function normalizePagination(
  options?: PaginationOptions
): NormalizedPagination {
  const page = Math.max(1, Math.floor(options?.page ?? 1));
  const requestedSize = Math.max(
    1,
    Math.floor(options?.pageSize ?? DEFAULT_PAGE_SIZE)
  );
  const pageSize = Math.min(requestedSize, MAX_PAGE_SIZE);

  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

function ensureMetricsColumns(db: SqliteDatabase) {
  const columns = db
    .prepare("PRAGMA table_info(tweets)")
    .all() as Array<{ name: string }>;

  const ensure = (name: string, definition: string) => {
    if (!columns.some((col) => col.name === name)) {
      db.exec(`ALTER TABLE tweets ADD COLUMN ${definition}`);
    }
  };

  ensure("publishedTweetId", "publishedTweetId TEXT");
  ensure("likesCount", "likesCount INTEGER NOT NULL DEFAULT 0");
  ensure("retweetsCount", "retweetsCount INTEGER NOT NULL DEFAULT 0");
  ensure("repliesCount", "repliesCount INTEGER NOT NULL DEFAULT 0");
  ensure("quotesCount", "quotesCount INTEGER NOT NULL DEFAULT 0");
  ensure("viewsCount", "viewsCount INTEGER NOT NULL DEFAULT 0");
  ensure("lastMetricsUpdate", "lastMetricsUpdate TEXT");
}
