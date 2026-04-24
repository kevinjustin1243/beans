from fastapi import APIRouter, Depends, HTTPException
from modules.auth import require_user
from pydantic import BaseModel

from modules.ledger import get_ledger

router = APIRouter(prefix="/api/query", tags=["query"])


class QueryIn(BaseModel):
    bql: str


@router.post("")
def run_query(body: QueryIn, username: str = Depends(require_user)):
    try:
        entries, _, options = get_ledger(username)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    try:
        from beanquery.query import run_query
        result_types, result_rows = run_query(entries, options, body.bql)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    columns = [col[0] for col in result_types]
    rows = [
        {col: _serialize_cell(val) for col, val in zip(columns, row)}
        for row in result_rows
    ]
    return {"columns": columns, "rows": rows}


def _serialize_cell(val) -> object:
    if val is None:
        return None
    if hasattr(val, "number") and hasattr(val, "currency"):
        return {"number": str(val.number), "currency": val.currency}
    if hasattr(val, "__iter__") and not isinstance(val, str):
        return list(val)
    return str(val) if not isinstance(val, (int, float, bool)) else val
