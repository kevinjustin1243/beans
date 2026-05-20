"""Per-deployment configuration loaded from ~/.config/beans/config.yaml.

Config is read lazily on every call rather than at import time so that the
process can start even when the file is missing or malformed — endpoints that
need it (login, /health) raise a useful error instead of the import system
failing first.
"""

import os
from pathlib import Path
import yaml


def _config_path() -> Path:
    override = os.environ.get("BEANS_CONFIG")
    if override:
        return Path(override).expanduser()
    return Path.home() / ".config" / "beans" / "config.yaml"


def _load_config() -> dict:
    path = _config_path()
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    with open(path) as f:
        return yaml.safe_load(f) or {}


def _get(key: str, required: bool = True) -> str:
    cfg = _load_config()
    val = cfg.get(key)
    if not val and required:
        raise ValueError(f"'{key}' key missing from {_config_path()}")
    return str(val) if val else ""


def get_secret_key() -> str:
    """JWT signing key. Lazily loaded so import never fails."""
    return _get("secret_key")


def get_users() -> dict[str, dict]:
    """Returns {username: {password: <bcrypt hash>, ledger: <path>}}."""
    cfg = _load_config()
    raw = cfg.get("users") or {}
    out: dict[str, dict] = {}
    for name, val in raw.items():
        if isinstance(val, str):
            raise ValueError(
                f"User '{name}' uses legacy config format. Rewrite users: as:\n"
                f"  users:\n    {name}:\n      password: <bcrypt-hash>\n      ledger: <path-to-ledger>"
            )
        if not isinstance(val, dict) or "password" not in val or "ledger" not in val:
            raise ValueError(f"User '{name}' must have 'password' and 'ledger' fields")
        out[name] = val
    return out


def get_user_ledger(username: str) -> str:
    user = get_users().get(username)
    if not user:
        raise KeyError(f"User '{username}' not found in config")
    return str(Path(user["ledger"]).expanduser())
