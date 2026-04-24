import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from modules.auth import require_user

from modules import reports as rpt

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/trial-balance")
def trial_balance(username: str = Depends(require_user)):
    try:
        return {"rows": rpt.trial_balance(username)}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/balance-sheet")
def balance_sheet(
    date: Optional[datetime.date] = Query(None),
    username: str = Depends(require_user),
):
    try:
        return rpt.balance_sheet(username, date)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/income-statement")
def income_statement(
    start: Optional[datetime.date] = Query(None),
    end: Optional[datetime.date] = Query(None),
    username: str = Depends(require_user),
):
    try:
        return rpt.income_statement(username, start, end)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
