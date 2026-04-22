import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from modules.auth import require_user
from pydantic import BaseModel

from modules import reports as rpt
from modules.ledger import get_ledger

router = APIRouter(prefix="/api/reports", tags=["reports"], dependencies=[Depends(require_user)])


@router.get("/trial-balance")
def trial_balance():
    try:
        return {"rows": rpt.trial_balance()}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/balance-sheet")
def balance_sheet(date: Optional[datetime.date] = Query(None)):
    try:
        return rpt.balance_sheet(date)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/income-statement")
def income_statement(
    start: Optional[datetime.date] = Query(None),
    end: Optional[datetime.date] = Query(None),
):
    try:
        return rpt.income_statement(start, end)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
