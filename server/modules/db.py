import sqlite3
from pathlib import Path

_DB_PATH = Path.home() / ".config" / "beans" / "beans.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS budget_targets (
                account TEXT PRIMARY KEY,
                amount   REAL NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS goals (
                id             TEXT PRIMARY KEY,
                name           TEXT NOT NULL,
                target_amount  REAL NOT NULL,
                currency       TEXT NOT NULL DEFAULT 'USD',
                account        TEXT NOT NULL DEFAULT '',
                manual_current REAL NOT NULL DEFAULT 0
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS investments (
                id          TEXT PRIMARY KEY,
                ticker      TEXT NOT NULL,
                name        TEXT,
                shares      REAL NOT NULL,
                cost_basis  REAL NOT NULL,
                created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS investment_quotes (
                ticker         TEXT PRIMARY KEY,
                price          REAL,
                currency       TEXT DEFAULT 'USD',
                name           TEXT,
                prev_close     REAL,
                change         REAL,
                change_percent REAL,
                fetched_at     TEXT
            )
        """)
        conn.commit()
