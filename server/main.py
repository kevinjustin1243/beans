from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from api.accounts import router as accounts_router
from api.transactions import router as transactions_router
from api.reports import router as reports_router
from api.query import router as query_router
from api.auth import router as auth_router
from api.budget import router as budget_router
from api.goals import router as goals_router
from api.directives import router as directives_router
from api.investments import router as investments_router
from modules.auth import require_user
from modules.config import get_users
from modules.db import init_db
from modules.ledger import get_ledger

app = FastAPI(title="beans api", version="0.1.0")
init_db()

app.add_middleware(
    CORSMiddleware,
    # Allow localhost + private-range IPs (LAN + typical VPN subnets) on any port.
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(accounts_router)
app.include_router(transactions_router)
app.include_router(reports_router)
app.include_router(query_router)
app.include_router(budget_router)
app.include_router(goals_router)
app.include_router(directives_router)
app.include_router(investments_router)


@app.get("/health")
def health():
    """Unauthenticated — checks config can be parsed and per-user ledgers resolve."""
    try:
        users = get_users()
    except Exception as e:
        return {"status": "error", "detail": str(e)}
    return {"status": "ok", "users": list(users.keys())}


@app.get("/api/errors")
def parse_errors(username: str = Depends(require_user)):
    try:
        _, errors, _ = get_ledger(username)
    except FileNotFoundError as e:
        return {"errors": [str(e)]}

    return {
        "errors": [
            {
                "message": str(e.message) if hasattr(e, "message") else str(e),
                "source": str(e.source) if hasattr(e, "source") else None,
            }
            for e in errors
        ]
    }
