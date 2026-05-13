import csv
import io
import re
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.auth.routes import get_current_user
from app.database import get_db
from app.models import User, DailyUpdateReport
from app.services.claude_client import ClaudeClient
from app.config import settings

router = APIRouter()

MAX_TICKETS = 300
FRESHDESK_BASE = f"https://{settings.FRESHDESK_DOMAIN}/api/v2"
FRESHDESK_AUTH = (settings.FRESHDESK_API_KEY, "X")




def _fetch_ticket(ticket_id: int) -> dict | None:
    import time
    for attempt in range(3):
        try:
            r = requests.get(
                f"{FRESHDESK_BASE}/tickets/{ticket_id}",
                auth=_auth,
                timeout=10,
            )
            if r.status_code == 200:
                return r.json()
            if r.status_code == 429:
                time.sleep(2 ** attempt)
                continue
        except Exception:
            pass
        break
    return None


def _get_tracker_info(ticket_ids: list[int], auth=None) -> dict:
    """
    Returns {ticket_id: {"tracker_id": int, "tracker_subject": str, "tracker_status": str}}
    for tickets that are associated with a tracker (association_type == 4).
    """
    STATUS_MAP = {
        2: "Open", 3: "Pending", 4: "Resolved", 5: "Closed",
        6: "Waiting on Customer", 7: "Waiting on Third Party", 13: "Ready for Production",
    }

    tracker_cache = {}  # tracker_id -> {subject, status}
    result = {}
    _auth = auth or FRESHDESK_AUTH

    # Fetch all ticket details in parallel (max 10 workers)
    ticket_data = {}
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(_fetch_ticket, tid): tid for tid in ticket_ids}
        for future in as_completed(futures):
            tid = futures[future]
            data = future.result()
            if data:
                ticket_data[tid] = data

    # Identify which have trackers (association_type == 4)
    tracker_ids_needed = set()
    for tid, data in ticket_data.items():
        if data.get("association_type") == 4:
            assoc = data.get("associated_tickets_list", [])
            if assoc:
                tracker_ids_needed.add(assoc[0])

    # Fetch tracker details in parallel
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(_fetch_ticket, tr_id): tr_id for tr_id in tracker_ids_needed}
        for future in as_completed(futures):
            tr_id = futures[future]
            data = future.result()
            if data:
                tracker_cache[tr_id] = {
                    "subject": data.get("subject", f"Tracker #{tr_id}"),
                    "status": STATUS_MAP.get(data.get("status"), f"Status {data.get('status')}"),
                    "tags": data.get("tags", []),
                    "url": f"https://{settings.FRESHDESK_DOMAIN}/a/tickets/{tr_id}",
                }

    # Build result mapping
    for tid, data in ticket_data.items():
        if data.get("association_type") == 4:
            assoc = data.get("associated_tickets_list", [])
            if assoc and assoc[0] in tracker_cache:
                result[tid] = {"tracker_id": assoc[0], **tracker_cache[assoc[0]]}

    return result, tracker_cache


@router.post("/analyze")
async def analyze_daily_update(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
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
        if "Description" in row and row["Description"]:
            row["Description"] = row["Description"][:600]
        tickets.append(dict(row))
        if len(tickets) >= MAX_TICKETS:
            break

    if not tickets:
        raise HTTPException(status_code=400, detail="CSV is empty or has no valid rows")

    # Get ticket IDs from CSV
    csv_ticket_ids = []
    for t in tickets:
        raw_id = str(t.get("Ticket ID", "")).strip()
        if raw_id.isdigit():
            csv_ticket_ids.append(int(raw_id))

    # 1. Fetch tracker info from Freshdesk
    user_fd_auth = (current_user.freshdesk_api_key, "X") if current_user.freshdesk_api_key else FRESHDESK_AUTH
    tracker_by_ticket, tracker_details = _get_tracker_info(csv_ticket_ids, auth=user_fd_auth)

    # 2. Build tracker groups (tracker_id -> list of ticket_ids from CSV)
    tracker_groups = {}
    for tid, info in tracker_by_ticket.items():
        tr_id = info["tracker_id"]
        if tr_id not in tracker_groups:
            tracker_groups[tr_id] = {
                "tracker_id": tr_id,
                "subject": info["subject"],
                "status": info["status"],
                "tags": info["tags"],
                "url": info["url"],
                "ticket_ids": [],
            }
        tracker_groups[tr_id]["ticket_ids"].append(tid)

    # 3. Run Claude analysis
    claude = ClaudeClient(api_key=settings.ANTHROPIC_API_KEY)
    result = claude.analyze_daily_update(tickets)

    # 4. Annotate groups with tracker info
    for group in result.get("groups", []):
        group["tracker_ids"] = list({
            tracker_by_ticket[tid]["tracker_id"]
            for tid in group.get("ticket_ids", [])
            if tid in tracker_by_ticket
        })

    csv_id_set = set(csv_ticket_ids)
    total_with_tracker = len(set(tracker_by_ticket.keys()) & csv_id_set)

    result["tracker_groups"] = list(tracker_groups.values())
    result["tracker_details"] = tracker_details
    result["total_tickets"] = len(tickets)
    result["total_with_freshdesk_tracker"] = total_with_tracker
    result["filename"] = file.filename or "upload.csv"

    # 6. Save to DB
    report = DailyUpdateReport(
        user_id=current_user.id,
        filename=file.filename or "upload.csv",
        total_tickets=len(tickets),
        total_tracked=total_with_tracker,
        result_json=result,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    result["report_id"] = report.id

    return result


@router.get("/history")
async def get_daily_update_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reports = (
        db.query(DailyUpdateReport)
        .order_by(DailyUpdateReport.created_at.desc())
        .limit(30)
        .all()
    )
    return [
        {
            "id": r.id,
            "filename": r.filename,
            "total_tickets": r.total_tickets,
            "total_tracked": r.total_tracked,
            "group_count": len(r.result_json.get("groups", [])) if r.result_json else 0,
            "created_at": r.created_at.isoformat(),
        }
        for r in reports
    ]


@router.get("/history/{report_id}")
async def get_daily_update_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(DailyUpdateReport).filter(DailyUpdateReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report.result_json

@router.delete("/history/{report_id}")
async def delete_daily_update_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(DailyUpdateReport).filter(DailyUpdateReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(report)
    db.commit()
    return {"ok": True}
