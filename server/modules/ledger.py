import os
import threading
from pathlib import Path

from beancount import loader
from beancount.core import realization

from .config import get_user_ledger

_caches: dict[str, dict] = {}
_lock = threading.Lock()


def _path_for(username: str) -> Path:
    path = Path(get_user_ledger(username))
    if not path.exists():
        raise FileNotFoundError(f"Beancount file not found: {path}")
    return path


def get_ledger(username: str) -> tuple[list, list, dict]:
    path = _path_for(username)
    with _lock:
        c = _caches.get(username)
        current_mtime = os.path.getmtime(path)
        if c is None or c["mtime"] != current_mtime or c["path"] != str(path):
            entries, errors, options = loader.load_file(str(path))
            _caches[username] = {
                "entries": entries,
                "errors": errors,
                "options": options,
                "mtime": current_mtime,
                "path": str(path),
            }
        c = _caches[username]
    return c["entries"], c["errors"], c["options"]


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


def _read_lines(username: str) -> list[str]:
    return _path_for(username).read_text().splitlines(keepends=True)


def _write_lines(username: str, lines: list[str]) -> None:
    _path_for(username).write_text("".join(lines))


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


def delete_transaction(username: str, lineno: int) -> None:
    lines = _read_lines(username)
    start, end = _get_extent(lines, lineno)
    del lines[start : end + 1]
    _write_lines(username, lines)


def replace_transaction(username: str, lineno: int, new_text: str) -> None:
    lines = _read_lines(username)
    start, end = _get_extent(lines, lineno)
    new_lines = (new_text.rstrip("\n") + "\n").splitlines(keepends=True)
    lines[start : end + 1] = new_lines
    _write_lines(username, lines)


def append_text(username: str, text: str) -> None:
    path = _path_for(username)
    with open(path, "a") as f:
        f.write("\n" + text + ("\n" if not text.endswith("\n") else ""))


def get_balances(username: str) -> dict:
    entries, _, _ = get_ledger(username)
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
