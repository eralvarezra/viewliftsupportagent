# backend/app/routes/users.py
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.routes import require_admin, get_current_user
from app.database import get_db
from app.models import User, ResponseHistory
from app.schemas import UserAdminItem, SetGoalRequest

router = APIRouter()


def _today_start() -> datetime:
    return datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)


@router.get("/", response_model=List[UserAdminItem])
async def list_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.desc()).all()

    total_counts = dict(
        db.query(ResponseHistory.user_id, func.count(ResponseHistory.id))
        .group_by(ResponseHistory.user_id)
        .all()
    )

    today_counts = dict(
        db.query(ResponseHistory.user_id, func.count(ResponseHistory.id))
        .filter(ResponseHistory.created_at >= _today_start())
        .group_by(ResponseHistory.user_id)
        .all()
    )

    result = []
    for u in users:
        raw_offset = u.daily_offset or 0
        today_date = datetime.utcnow().strftime("%Y-%m-%d")
        offset = raw_offset if u.daily_offset_date == today_date else 0
        result.append(UserAdminItem(
            id=u.id,
            username=u.username,
            email=u.email,
            role=u.role,
            status=u.status or "active",
            created_at=u.created_at,
            ticket_count=total_counts.get(u.id, 0),
            today_count=today_counts.get(u.id, 0) + offset,
            daily_goal=u.daily_goal or 35,
            monthly_cost=u.monthly_cost or 0.0,
        ))
    return result


@router.patch("/{user_id}/status")
async def set_user_status(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own status")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    current_status = user.status or "active"
    if current_status == "pending":
        user.status = "active"
        user.is_active = True
    elif current_status == "active":
        user.status = "inactive"
        user.is_active = False
    else:
        user.status = "active"
        user.is_active = True

    db.commit()
    return {"id": user.id, "username": user.username, "status": user.status}


@router.patch("/{user_id}/goal")
async def set_user_goal(
    user_id: int,
    request: SetGoalRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if request.goal < 1:
        raise HTTPException(status_code=400, detail="Goal must be at least 1")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.daily_goal = request.goal
    db.commit()
    return {"id": user.id, "username": user.username, "daily_goal": user.daily_goal}


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete another admin")

    db.query(ResponseHistory).filter(ResponseHistory.user_id == user_id).delete()
    db.delete(user)
    db.commit()
    return {"message": f"User {user.username} deleted"}

@router.get("/me")
def get_my_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "freshdesk_api_key": current_user.freshdesk_api_key or "",
    }

@router.put("/me/freshdesk-key")
def update_freshdesk_key(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    key = body.get("freshdesk_api_key", "").strip()
    current_user.freshdesk_api_key = key or None
    db.commit()
    return {"ok": True, "freshdesk_api_key": current_user.freshdesk_api_key or ""}
