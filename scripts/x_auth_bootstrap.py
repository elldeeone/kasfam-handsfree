#!/usr/bin/env python3
"""
Bootstrap OAuth2 (PKCE) tokens for X API via Tweepy.

Prompts for the full redirect URL after you complete consent, then stores
access_token and refresh_token in data/x_tokens.json (gitignored via /data).

Env vars required:
- X_CLIENT_ID
- X_CLIENT_SECRET (recommended for confidential client)
- X_REDIRECT_URI

Scopes (default): tweet.read users.read offline.access
"""

import json
import os
import sys
from pathlib import Path

import tweepy

DEFAULT_SCOPES = ["tweet.read", "users.read", "offline.access"]
TOKEN_PATH = Path(os.getenv("X_TOKEN_PATH", "data/x_tokens.json"))


def main():
    client_id = os.getenv("X_CLIENT_ID")
    client_secret = os.getenv("X_CLIENT_SECRET")
    redirect_uri = os.getenv("X_REDIRECT_URI")
    scopes = os.getenv("X_SCOPES", " ".join(DEFAULT_SCOPES)).split()

    if not client_id or not redirect_uri:
        sys.exit("Set X_CLIENT_ID and X_REDIRECT_URI (and X_CLIENT_SECRET for confidential client).")

    handler = tweepy.OAuth2UserHandler(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scope=scopes,
    )

    auth_url = handler.get_authorization_url()
    print("Visit this URL, authorize, then paste the full redirect URL below:")
    print(auth_url)
    redirect_response = input("\nFull redirect URL: ").strip()
    if not redirect_response:
        sys.exit("No redirect URL provided.")

    try:
        token = handler.fetch_token(redirect_response)
    except Exception as exc:
        sys.exit(f"Failed to fetch token: {exc}")

    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    with TOKEN_PATH.open("w") as f:
        json.dump(token, f, indent=2)

    print(f"Tokens saved to {TOKEN_PATH} (gitignored).")
    print("Fields:", ", ".join(token.keys()))


if __name__ == "__main__":
    main()
