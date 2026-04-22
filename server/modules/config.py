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


def _get_beancount_file() -> str:
    return str(Path(_get("ledger")).expanduser())


BEANCOUNT_FILE = _get_beancount_file()
SECRET_KEY = _get("secret_key")


def get_users() -> dict[str, str]:
    """Returns {username: hashed_password} from config."""
    cfg = _load_config()
    return cfg.get("users") or {}
