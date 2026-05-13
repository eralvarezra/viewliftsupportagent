from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.auth.routes import require_admin
from app.models import User
from app.services.claude_client import ClaudeClient
from app.config import settings
import csv
import io

router = APIRouter()

MAX_TICKETS = 300


@router.post("/analyze")
async def analyze_daily_update(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
):
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv")

    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    tickets = []
    for row in reader:
        # Trim description to avoid token overflow
        if "Description" in row and row["Description"]:
            row["Description"] = row["Description"][:600]
        tickets.append(dict(row))
        if len(tickets) >= MAX_TICKETS:
            break

    if not tickets:
        raise HTTPException(status_code=400, detail="CSV is empty or has no valid rows")

    claude = ClaudeClient(api_key=settings.ANTHROPIC_API_KEY)
    result = claude.analyze_daily_update(tickets)
    result["total_tickets"] = len(tickets)
    result["filename"] = file.filename or "upload.csv"
    return result
