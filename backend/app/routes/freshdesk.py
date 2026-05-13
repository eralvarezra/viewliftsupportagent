import re
import requests
from fastapi import APIRouter, Depends, HTTPException
from app.auth.routes import get_current_user
from app.models import User
from app.config import settings

router = APIRouter()

FRESHDESK_BASE = f"https://{settings.FRESHDESK_DOMAIN}/api/v2"
FRESHDESK_AUTH = (settings.FRESHDESK_API_KEY, "X")

STATUS_MAP = {2: "Open", 3: "Pending", 4: "Resolved", 5: "Closed", 6: "Waiting on Customer", 7: "Waiting on Third Party"}
PRIORITY_MAP = {1: "Low", 2: "Medium", 3: "High", 4: "Urgent"}

@router.get("/ticket/{ticket_id}")
async def get_freshdesk_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
):
    r = requests.get(
        f"{FRESHDESK_BASE}/tickets/{ticket_id}?include=requester,company",
        auth=FRESHDESK_AUTH,
        timeout=10,
    )
    if r.status_code == 404:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if r.status_code == 429:
        raise HTTPException(status_code=429, detail="Freshdesk rate limit reached, try again later")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Freshdesk returned {r.status_code}")

    t = r.json()
    return {
        "id": t["id"],
        "subject": t.get("subject", ""),
        "description": t.get("description_text", ""),
        "status": STATUS_MAP.get(t.get("status"), str(t.get("status"))),
        "priority": PRIORITY_MAP.get(t.get("priority"), str(t.get("priority"))),
        "type": t.get("type"),
        "tags": t.get("tags", []),
        "requester_name": t.get("requester", {}).get("name"),
        "requester_email": t.get("requester", {}).get("email"),
        "company": t.get("company", {}).get("name") if t.get("company") else None,
        "url": f"https://{settings.FRESHDESK_DOMAIN}/a/tickets/{t['id']}",
    }
