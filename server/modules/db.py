import sqlite3
from pathlib import Path

_DB_PATH = Path.home() / ".config" / "beans" / "beans.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


_TABLES = [
    (
        "budget_targets",
        "user TEXT NOT NULL, account TEXT NOT NULL, amount REAL NOT NULL, PRIMARY KEY (user, account)",
        "account, amount",
    ),
    (
        "goals",
        "id TEXT PRIMARY KEY, user TEXT NOT NULL, name TEXT NOT NULL, target_amount REAL NOT NULL, "
        "currency TEXT NOT NULL DEFAULT 'USD', account TEXT NOT NULL DEFAULT '', "
        "manual_current REAL NOT NULL DEFAULT 0",
        "id, name, target_amount, currency, account, manual_current",
    ),
    (
        "investments",
        "id TEXT PRIMARY KEY, user TEXT NOT NULL, ticker TEXT NOT NULL, name TEXT, "
        "shares REAL NOT NULL, cost_basis REAL NOT NULL, "
        "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
        "id, ticker, name, shares, cost_basis, created_at",
    ),
]


def _ensure_with_user(conn, table: str, schema: str, copy_cols: str) -> None:
    info = conn.execute(f"PRAGMA table_info({table})").fetchall()
    cols = [r[1] for r in info]
    if not cols:
        conn.execute(f"CREATE TABLE {table} ({schema})")
        return
    if "user" in cols:
        return
    conn.execute(f"ALTER TABLE {table} RENAME TO {table}__old")
    conn.execute(f"CREATE TABLE {table} ({schema})")
    conn.execute(
        f"INSERT OR IGNORE INTO {table} (user, {copy_cols}) "
        f"SELECT '', {copy_cols} FROM {table}__old"
    )
    conn.execute(f"DROP TABLE {table}__old")


def init_db() -> None:
    with get_conn() as conn:
        for table, schema, copy_cols in _TABLES:
            _ensure_with_user(conn, table, schema, copy_cols)
        # Quote cache is global market data — shared across users.
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
