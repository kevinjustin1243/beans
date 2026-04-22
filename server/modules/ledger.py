import os
import threading
from decimal import Decimal
from pathlib import Path

from beancount import loader
from beancount.core import data, getters, realization
from beancount.core.number import ZERO

from .config import BEANCOUNT_FILE

_entries: list = []
_errors: list = []
_options: dict = {}
_mtime: float | None = None
_lock = threading.Lock()


def _load() -> None:
    global _entries, _errors, _options, _mtime
    entries, errors, options = loader.load_file(BEANCOUNT_FILE)
    _entries = entries
    _errors = errors
    _options = options
    _mtime = os.path.getmtime(BEANCOUNT_FILE)


def get_ledger() -> tuple[list, list, dict]:
    global _mtime
    path = Path(BEANCOUNT_FILE)
    if not path.exists():
        raise FileNotFoundError(f"Beancount file not found: {BEANCOUNT_FILE}")
    with _lock:
        current_mtime = os.path.getmtime(BEANCOUNT_FILE)
        if _mtime != current_mtime:
            _load()
    return _entries, _errors, _options


def serialize_amount(amount) -> dict | None:
    if amount is None:
        return None
    return {"number": str(amount.number), "currency": amount.currency}


def serialize_posting(posting) -> dict:
    return {
        "account": posting.account,
        "units": serialize_amount(posting.units),
        "cost": str(posting.cost) if posting.cost else None,
        "price": serialize_amount(posting.price),
        "flag": posting.flag,
    }


def serialize_transaction(entry) -> dict:
    return {
        "id": str(entry.meta.get("lineno", 0)),
        "type": "transaction",
        "date": str(entry.date),
        "flag": entry.flag,
        "payee": entry.payee,
        "narration": entry.narration,
        "tags": sorted(entry.tags),
        "links": sorted(entry.links),
        "postings": [serialize_posting(p) for p in entry.postings],
        "meta": {"filename": entry.meta.get("filename"), "lineno": entry.meta.get("lineno")},
    }


def _read_lines() -> list[str]:
    return Path(BEANCOUNT_FILE).read_text().splitlines(keepends=True)


def _write_lines(lines: list[str]) -> None:
    Path(BEANCOUNT_FILE).write_text("".join(lines))


def _get_extent(lines: list[str], lineno: int) -> tuple[int, int]:
    """Return (start, end) 0-indexed inclusive line range for the entry at lineno (1-indexed)."""
    start = lineno - 1
    end = start
    i = start + 1
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            break
        if line[0] in (" ", "\t"):
            end = i
        else:
            break
        i += 1
    return start, end


def delete_transaction(lineno: int) -> None:
    lines = _read_lines()
    start, end = _get_extent(lines, lineno)
    del lines[start : end + 1]
    _write_lines(lines)


def replace_transaction(lineno: int, new_text: str) -> None:
    lines = _read_lines()
    start, end = _get_extent(lines, lineno)
    new_lines = (new_text.rstrip("\n") + "\n").splitlines(keepends=True)
    lines[start : end + 1] = new_lines
    _write_lines(lines)


def get_balances() -> dict:
    entries, _, _ = get_ledger()
    real_root = realization.realize(entries)
    return _walk_real_account(real_root)


def _walk_real_account(real_account) -> dict:
    balance: dict[str, str] = {}
    for pos in real_account.balance:
        balance[pos.units.currency] = str(pos.units.number)

    children = {
        name: _walk_real_account(child)
        for name, child in sorted(real_account.items())
    }
    return {
        "account": real_account.account,
        "balance": balance,
        "children": children,
    }
