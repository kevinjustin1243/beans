from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.accounts import router as accounts_router
from api.transactions import router as transactions_router
from api.reports import router as reports_router
from api.query import router as query_router
from api.auth import router as auth_router
from api.budget import router as budget_router
from api.goals import router as goals_router
from modules.db import init_db
from modules.ledger import get_ledger

app = FastAPI(title="beans api", version="0.1.0")
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
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


@app.get("/health")
def health():
    try:
        _, errors, _ = get_ledger()
        return {"status": "ok", "errors": len(errors)}
    except FileNotFoundError as e:
        return {"status": "error", "detail": str(e)}


@app.get("/api/errors")
def parse_errors():
    try:
        _, errors, _ = get_ledger()
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
