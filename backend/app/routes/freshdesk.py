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


def _build_full_thread(ticket: dict, conversations: list) -> str:
    """Build a formatted message thread similar to manual paste format."""
    requester_name = ticket.get("requester", {}).get("name", "Customer")
    requester_email = ticket.get("requester", {}).get("email", "")
    company = ticket.get("company", {}).get("name") if ticket.get("company") else None
    subject = ticket.get("subject", "")
    status = STATUS_MAP.get(ticket.get("status"), str(ticket.get("status")))
    tags = ticket.get("tags", [])

    lines = []

    # Header
    lines.append(f"[Ticket #{ticket['id']}] {subject}")
    lines.append(f"Status: {status} | Priority: {PRIORITY_MAP.get(ticket.get('priority'), '')}")
    if company:
        lines.append(f"Client: {company}")
    lines.append(f"From: {requester_name} ({requester_email})")
    if tags:
        lines.append(f"Tags: {', '.join(tags)}")
    lines.append("")

    # Original message
    lines.append("[Customer - Original Message]")
    lines.append(ticket.get("description_text", "").strip())
    lines.append("")

    # Conversations (replies and notes)
    for conv in conversations:
        if conv.get("private"):
            # Private note = agent internal note, skip or label
            continue
        is_incoming = conv.get("incoming", False)
        body = conv.get("body_text", "").strip()
        if not body:
            continue

        if is_incoming:
            sender = conv.get("from_email") or requester_email or "Customer"
            lines.append(f"[Customer Reply]")
        else:
            sender = conv.get("support_email") or "Agent"
            lines.append(f"[Agent Reply]")

        lines.append(body)
        lines.append("")

    return "\n".join(lines)


@router.get("/ticket/{ticket_id}")
async def get_freshdesk_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
):
    auth = (current_user.freshdesk_api_key, "X") if current_user.freshdesk_api_key else FRESHDESK_AUTH

    # Fetch ticket
    r = requests.get(
        f"{FRESHDESK_BASE}/tickets/{ticket_id}?include=requester,company",
        auth=auth,
        timeout=10,
    )
    if r.status_code == 404:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if r.status_code == 429:
        raise HTTPException(status_code=429, detail="Freshdesk rate limit reached, try again later")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Freshdesk returned {r.status_code}")

    t = r.json()

    # Fetch conversations (full thread)
    conv_r = requests.get(
        f"{FRESHDESK_BASE}/tickets/{ticket_id}/conversations",
        auth=auth,
        timeout=10,
    )
    conversations = conv_r.json() if conv_r.status_code == 200 else []

    full_thread = _build_full_thread(t, conversations)

    return {
        "id": t["id"],
        "subject": t.get("subject", ""),
        "description": t.get("description_text", ""),
        "full_thread": full_thread,
        "status": STATUS_MAP.get(t.get("status"), str(t.get("status"))),
        "priority": PRIORITY_MAP.get(t.get("priority"), str(t.get("priority"))),
        "type": t.get("type"),
        "tags": t.get("tags", []),
        "requester_name": t.get("requester", {}).get("name"),
        "requester_email": t.get("requester", {}).get("email"),
        "company": t.get("company", {}).get("name") if t.get("company") else None,
        "url": f"https://{settings.FRESHDESK_DOMAIN}/a/tickets/{t['id']}",
        "conversation_count": len(conversations),
    }
