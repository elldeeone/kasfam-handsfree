#!/usr/bin/env python3
"""
Fetch engagement metrics for tweets with a publishedTweetId.

Usage:
  python scripts/fetch_metrics.py --db data/app.db --limit 50

Auth:
  - Prefer X_BEARER_TOKEN for public metrics.
  - Alternatively set X_CONSUMER_KEY, X_CONSUMER_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET for user-context auth.
  - PKCE token storage can be added later; this script keeps secrets in env and writes nothing sensitive to disk.

This script does not change ingestion; it only updates metrics for rows that already have publishedTweetId set.
"""

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List, Tuple

import tweepy


def get_client() -> tweepy.Client:
    bearer = os.getenv("X_BEARER_TOKEN")
    if bearer:
        return tweepy.Client(bearer_token=bearer, wait_on_rate_limit=True)

    tokens_path = Path(os.getenv("X_TOKEN_PATH", "data/x_tokens.json"))
    if tokens_path.exists():
        token_data = json.loads(tokens_path.read_text())
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        client_id = os.getenv("X_CLIENT_ID")
        client_secret = os.getenv("X_CLIENT_SECRET")
        if access_token and client_id:
            return tweepy.Client(
                client_id=client_id,
                client_secret=client_secret,
                access_token=access_token,
                refresh_token=refresh_token,
                wait_on_rate_limit=True,
            )

    ck = os.getenv("X_CONSUMER_KEY")
    cs = os.getenv("X_CONSUMER_SECRET")
    at = os.getenv("X_ACCESS_TOKEN")
    ats = os.getenv("X_ACCESS_SECRET")
    if all([ck, cs, at, ats]):
        return tweepy.Client(
            consumer_key=ck,
            consumer_secret=cs,
            access_token=at,
            access_token_secret=ats,
            wait_on_rate_limit=True,
        )

    sys.exit(
        "Missing auth. Set X_BEARER_TOKEN or "
        "X_CONSUMER_KEY/X_CONSUMER_SECRET/X_ACCESS_TOKEN/X_ACCESS_SECRET or provide tokens at data/x_tokens.json."
    )


def fetch_targets(conn: sqlite3.Connection, limit: int) -> List[Tuple[str, str]]:
    cursor = conn.execute(
        """
        SELECT id, publishedTweetId
        FROM tweets
        WHERE publishedTweetId IS NOT NULL
        ORDER BY
          (lastMetricsUpdate IS NULL) DESC,
          datetime(lastMetricsUpdate) ASC
        LIMIT ?
        """,
        (limit,),
    )
    return [(row[0], row[1]) for row in cursor.fetchall()]


def update_metrics(
    conn: sqlite3.Connection,
    tweet_id: str,
    like_count: int,
    retweet_count: int,
    reply_count: int,
    quote_count: int,
    view_count: int,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """
        UPDATE tweets
        SET likesCount = ?, retweetsCount = ?, repliesCount = ?, quotesCount = ?, viewsCount = ?, lastMetricsUpdate = ?
        WHERE id = ?
        """,
        (
            like_count,
            retweet_count,
            reply_count,
            quote_count,
            view_count,
            now,
            tweet_id,
        ),
    )
    conn.execute(
        """
        INSERT INTO tweet_metrics_snapshots
          (tweetId, capturedAt, likesCount, retweetsCount, repliesCount, quotesCount, viewsCount)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            tweet_id,
            now,
            like_count,
            retweet_count,
            reply_count,
            quote_count,
            view_count,
        ),
    )


def chunked(iterable: Iterable, size: int) -> Iterable[list]:
    chunk = []
    for item in iterable:
        chunk.append(item)
        if len(chunk) >= size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk


def main():
    parser = argparse.ArgumentParser(
        description="Fetch engagement metrics for published tweets."
    )
    parser.add_argument("--db", default="data/app.db", help="Path to SQLite DB")
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        help="Max tweets to process this run (default 50)",
    )
    args = parser.parse_args()

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row

    targets = fetch_targets(conn, args.limit)
    if not targets:
        print("No tweets with publishedTweetId found.")
        return

    client = get_client()
    processed = 0

    for batch in chunked(targets, 50):
        id_map = {pub_id: row_id for row_id, pub_id in batch}
        ids = list(id_map.keys())
        try:
          # fetch tweets with public metrics
            response = client.get_tweets(
                ids=ids,
                tweet_fields=["public_metrics"],
            )
        except Exception as exc:  # Tweepy uses varied exceptions; keep simple
            print(f"Error fetching batch: {exc}", file=sys.stderr)
            continue

        tweets = response.data or []
        for t in tweets:
            metrics = t.public_metrics or {}
            like_count = int(metrics.get("like_count", 0))
            retweet_count = int(metrics.get("retweet_count", 0))
            reply_count = int(metrics.get("reply_count", 0))
            quote_count = int(metrics.get("quote_count", 0))
            view_count = int(metrics.get("impression_count", 0))
            update_metrics(
                conn,
                id_map.get(str(t.id), str(t.id)),
                like_count,
                retweet_count,
                reply_count,
                quote_count,
                view_count,
            )
            processed += 1

        conn.commit()

    print(f"Updated metrics for {processed} tweets.")


if __name__ == "__main__":
    main()
