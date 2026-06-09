import math
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


def _rate_limit_error(r) -> HTTPException:
    retry_after = r.headers.get("Retry-After")
    if retry_after:
        try:
            seconds = int(retry_after)
            minutes = math.ceil(seconds / 60)
            msg = f"Freshdesk rate limit reached. Try again in {minutes} minute{'s' if minutes != 1 else ''}."
        except ValueError:
            msg = f"Freshdesk rate limit reached. Try again after {retry_after}."
    else:
        msg = "Freshdesk rate limit reached, try again later."
    return HTTPException(status_code=429, detail=msg)


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
            continue
        is_incoming = conv.get("incoming", False)
        body = conv.get("body_text", "").strip()
        if not body:
            continue

        if is_incoming:
            lines.append(f"[Customer Reply]")
        else:
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

    r = requests.get(
        f"{FRESHDESK_BASE}/tickets/{ticket_id}?include=requester,company",
        auth=auth,
        timeout=10,
    )
    if r.status_code == 404:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if r.status_code == 429:
        raise _rate_limit_error(r)
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Freshdesk returned {r.status_code}")

    t = r.json()

    conv_r = requests.get(
        f"{FRESHDESK_BASE}/tickets/{ticket_id}/conversations",
        auth=auth,
        timeout=10,
    )
    conversations = conv_r.json() if conv_r.status_code == 200 else []

    full_thread = _build_full_thread(t, conversations)

    rl_remaining = r.headers.get("X-RateLimit-Remaining")
    rl_total = r.headers.get("X-RateLimit-Total")

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
        "rate_limit_remaining": int(rl_remaining) if rl_remaining else None,
        "rate_limit_total": int(rl_total) if rl_total else 5000,
    }


@router.get("/tracker/{tracker_id}")
async def get_tracker_details(
    tracker_id: int,
    current_user: User = Depends(get_current_user),
):
    auth = (current_user.freshdesk_api_key, "X") if current_user.freshdesk_api_key else FRESHDESK_AUTH

    r = requests.get(f"{FRESHDESK_BASE}/tickets/{tracker_id}", auth=auth, timeout=10)
    if r.status_code == 404:
        raise HTTPException(status_code=404, detail="Tracker not found")
    if r.status_code == 429:
        raise _rate_limit_error(r)
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Freshdesk returned {r.status_code}")

    t = r.json()

    conv_r = requests.get(f"{FRESHDESK_BASE}/tickets/{tracker_id}/conversations", auth=auth, timeout=10)
    conversations = conv_r.json() if conv_r.status_code == 200 else []

    latest_note = None
    for c in reversed(conversations):
        body = c.get("body_text", "").strip()
        if not body:
            continue
        latest_note = {
            "body": body[:500],
            "is_private": c.get("private", False),
            "created_at": c.get("created_at", ""),
            "incoming": c.get("incoming", False),
        }
        break

    TRACKER_STATUS_MAP = {2: "Open", 3: "Pending", 4: "Resolved", 5: "Closed", 6: "Waiting on Customer", 7: "Waiting on Third Party", 13: "Ready for Production"}

    return {
        "tracker_id": tracker_id,
        "subject": t.get("subject", f"Tracker #{tracker_id}"),
        "status": TRACKER_STATUS_MAP.get(t.get("status"), str(t.get("status"))),
        "tags": t.get("tags", []),
        "total_linked": len(t.get("associated_tickets_list", [])),
        "all_linked_ids": t.get("associated_tickets_list", []),
        "latest_note": latest_note,
    }


@router.get("/status")
async def get_freshdesk_status(
    current_user: User = Depends(get_current_user),
):
    """Quick check: is the Freshdesk API available and how many calls remain?"""
    auth = (current_user.freshdesk_api_key, "X") if current_user.freshdesk_api_key else FRESHDESK_AUTH
    try:
        r = requests.get(
            f"{FRESHDESK_BASE}/tickets?per_page=1",
            auth=auth,
            timeout=8,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail="Could not reach Freshdesk API")

    rl_remaining = r.headers.get("X-RateLimit-Remaining")
    rl_total = r.headers.get("X-RateLimit-Total")
    retry_after = r.headers.get("Retry-After")

    if r.status_code == 429:
        wait_seconds = None
        wait_str = "try again later"
        if retry_after:
            try:
                wait_seconds = int(retry_after)
                minutes = math.ceil(wait_seconds / 60)
                wait_str = f"in {minutes} minute{'s' if minutes != 1 else ''}"
            except ValueError:
                wait_str = f"after {retry_after}"
        return {
            "status": "rate_limited",
            "remaining": 0,
            "total": int(rl_total) if rl_total else 5000,
            "retry_after_seconds": wait_seconds,
            "message": f"Freshdesk API rate limit reached — try again {wait_str}.",
        }

    return {
        "status": "ok",
        "remaining": int(rl_remaining) if rl_remaining else None,
        "total": int(rl_total) if rl_total else 5000,
        "retry_after_seconds": None,
        "message": None,
    }
