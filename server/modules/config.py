from pathlib import Path
import yaml

_CONFIG_PATH = Path.home() / ".config" / "beans" / "config.yaml"


def _load_config() -> dict:
    if not _CONFIG_PATH.exists():
        raise FileNotFoundError(f"Config file not found: {_CONFIG_PATH}")
    with open(_CONFIG_PATH) as f:
        return yaml.safe_load(f) or {}


def _get(key: str, required: bool = True) -> str:
    cfg = _load_config()
    val = cfg.get(key)
    if not val and required:
        raise ValueError(f"'{key}' key missing from {_CONFIG_PATH}")
    return str(val) if val else ""


SECRET_KEY = _get("secret_key")


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
