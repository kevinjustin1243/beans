"""Postgres connection + schema bootstrapping.

Connection details come from the ``DATABASE_URL`` env var (libpq URI form,
e.g. ``postgres://beans:beans@db:5432/beans``). ``get_conn()`` returns a
psycopg3 connection with ``dict_row`` row factory so callers can keep using
``row["column"]`` access.

``init_db()`` is called from the FastAPI lifespan, not at import time, so the
app can be inspected (``--help``, OpenAPI generation, tests) without a live
database, and so it can retry while Postgres is still coming up in compose.
"""

from __future__ import annotations

import logging
import os
import time

import psycopg
from psycopg.rows import dict_row

log = logging.getLogger(__name__)


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. Example: "
            "postgres://beans:beans@db:5432/beans"
        )
    return url


def get_conn() -> psycopg.Connection:
    """Return a new dict-row Postgres connection.

    Used as a context manager by callers, so the connection is committed
    (or rolled back) and closed at the end of each request.
    """
    return psycopg.connect(_database_url(), row_factory=dict_row)


_DDL: list[str] = [
    """
    CREATE TABLE IF NOT EXISTS budget_targets (
        username TEXT NOT NULL,
        account  TEXT NOT NULL,
        amount   DOUBLE PRECISION NOT NULL,
        PRIMARY KEY (username, account)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS goals (
        id              TEXT PRIMARY KEY,
        username        TEXT NOT NULL,
        name            TEXT NOT NULL,
        target_amount   DOUBLE PRECISION NOT NULL,
        currency        TEXT NOT NULL DEFAULT 'USD',
        account         TEXT NOT NULL DEFAULT '',
        manual_current  DOUBLE PRECISION NOT NULL DEFAULT 0
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS investments (
        id          TEXT PRIMARY KEY,
        username    TEXT NOT NULL,
        ticker      TEXT NOT NULL,
        name        TEXT,
        shares      DOUBLE PRECISION NOT NULL,
        cost_basis  DOUBLE PRECISION NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    # Quote cache is global market data - shared across users.
    """
    CREATE TABLE IF NOT EXISTS investment_quotes (
        ticker         TEXT PRIMARY KEY,
        price          DOUBLE PRECISION,
        currency       TEXT DEFAULT 'USD',
        name           TEXT,
        prev_close     DOUBLE PRECISION,
        change         DOUBLE PRECISION,
        change_percent DOUBLE PRECISION,
        fetched_at     TIMESTAMPTZ
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS liabilities (
        id               TEXT PRIMARY KEY,
        username         TEXT NOT NULL,
        name             TEXT NOT NULL,
        balance          DOUBLE PRECISION NOT NULL,
        original_balance DOUBLE PRECISION NOT NULL,
        monthly_payment  DOUBLE PRECISION NOT NULL,
        rate             DOUBLE PRECISION NOT NULL,
        icon             TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS credit_scores (
        id        BIGSERIAL PRIMARY KEY,
        username  TEXT NOT NULL,
        month     DATE NOT NULL,
        score     INTEGER NOT NULL CHECK (score BETWEEN 300 AND 850),
        UNIQUE (username, month)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS watchlist (
        id         TEXT PRIMARY KEY,
        username   TEXT NOT NULL,
        ticker     TEXT NOT NULL,
        note       TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (username, ticker)
    )
    """,
    "CREATE INDEX IF NOT EXISTS goals_username_idx       ON goals (username)",
    "CREATE INDEX IF NOT EXISTS investments_username_idx ON investments (username)",
    "CREATE INDEX IF NOT EXISTS liabilities_username_idx ON liabilities (username)",
    "CREATE INDEX IF NOT EXISTS credit_scores_username_idx ON credit_scores (username)",
    "CREATE INDEX IF NOT EXISTS watchlist_username_idx   ON watchlist (username)",
    # ── Tier C: additive UI-polish columns. ADD COLUMN IF NOT EXISTS makes
    # these idempotent so init_db stays safe to call on every startup.
    "ALTER TABLE goals          ADD COLUMN IF NOT EXISTS icon  TEXT",
    "ALTER TABLE goals          ADD COLUMN IF NOT EXISTS color TEXT",
    "ALTER TABLE budget_targets ADD COLUMN IF NOT EXISTS color TEXT",
    "ALTER TABLE investments    ADD COLUMN IF NOT EXISTS asset_type TEXT",
    "ALTER TABLE investments    ADD COLUMN IF NOT EXISTS sector     TEXT",
]


def init_db(retries: int = 30, delay: float = 1.0) -> None:
    """Create tables, retrying while Postgres is still accepting connections.

    In compose, the backend starts in parallel with Postgres; the healthcheck
    blocks the dependency until the DB is ready, but in dev (running uvicorn
    directly) we still want to be forgiving. Retries cover both cases.
    """
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            with psycopg.connect(_database_url()) as conn:
                with conn.cursor() as cur:
                    for stmt in _DDL:
                        cur.execute(stmt)
            log.info("database schema ready (attempt %d)", attempt)
            return
        except psycopg.OperationalError as e:
            last_err = e
            log.warning("postgres not ready yet (attempt %d/%d): %s", attempt, retries, e)
            time.sleep(delay)
    raise RuntimeError(f"Postgres unavailable after {retries} attempts: {last_err}")
