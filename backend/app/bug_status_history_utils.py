"""
Utility functions for managing bug status history (audit trail)

Usage example:
    from app.bug_status_history_utils import record_status_change
    
    # When updating a bug status
    bug = db.query(BugReport).filter(BugReport.id == bug_id).first()
    old_status = bug.status
    bug.status = "in_progress"
    
    # Record the change
    record_status_change(
        db=db,
        bug_id=bug.id,
        from_status=old_status,
        to_status="in_progress",
        changed_by_user_id=current_user.id,
        comment="Starting work on this issue"
    )
    
    db.commit()
"""

from sqlalchemy.orm import Session
from datetime import datetime
from .models import BugStatusHistory


def record_status_change(
    db: Session,
    bug_id: int,
    to_status: str,
    changed_by_user_id: int | None = None,
    from_status: str | None = None,
    comment: str | None = None,
) -> BugStatusHistory:
    """
    Record a bug status change in the audit trail.
    
    Args:
        db: Database session
        bug_id: ID of the bug report
        to_status: New status value
        changed_by_user_id: ID of user making the change (optional)
        from_status: Previous status value (optional, NULL for initial status)
        comment: Optional comment explaining the change
        
    Returns:
        The created BugStatusHistory record
        
    Example:
        # Initial status (from_status is None)
        record_status_change(
            db=db,
            bug_id=1,
            to_status="new",
            changed_by_user_id=5,
            comment="Bug reported"
        )
        
        # Status transition
        record_status_change(
            db=db,
            bug_id=1,
            from_status="new",
            to_status="triaged",
            changed_by_user_id=3,
            comment="Confirmed and prioritized as high"
        )
    """
    history_entry = BugStatusHistory(
        bug_id=bug_id,
        from_status=from_status,
        to_status=to_status,
        changed_by_user_id=changed_by_user_id,
        comment=comment,
    )
    
    db.add(history_entry)
    # Note: Caller should commit the transaction
    
    return history_entry


def get_bug_status_timeline(db: Session, bug_id: int) -> list[BugStatusHistory]:
    """
    Get the complete status history for a bug, ordered chronologically.
    
    Args:
        db: Database session
        bug_id: ID of the bug report
        
    Returns:
        List of BugStatusHistory records ordered by created_at
        
    Example:
        timeline = get_bug_status_timeline(db, bug_id=1)
        for entry in timeline:
            user_name = entry.changed_by_user.name if entry.changed_by_user else "System"
            print(f"{entry.created_at}: {entry.from_status} → {entry.to_status} by {user_name}")
            if entry.comment:
                print(f"  Comment: {entry.comment}")
    """
    return (
        db.query(BugStatusHistory)
        .filter(BugStatusHistory.bug_id == bug_id)
        .order_by(BugStatusHistory.created_at)
        .all()
    )


def get_status_transitions_by_user(
    db: Session, user_id: int, limit: int = 50
) -> list[BugStatusHistory]:
    """
    Get recent status changes made by a specific user.
    
    Args:
        db: Database session
        user_id: ID of the user
        limit: Maximum number of records to return
        
    Returns:
        List of BugStatusHistory records ordered by created_at (newest first)
    """
    return (
        db.query(BugStatusHistory)
        .filter(BugStatusHistory.changed_by_user_id == user_id)
        .order_by(BugStatusHistory.created_at.desc())
        .limit(limit)
        .all()
    )


def format_status_timeline(timeline: list[BugStatusHistory]) -> str:
    """
    Format a status timeline as a human-readable string.
    
    Args:
        timeline: List of BugStatusHistory records
        
    Returns:
        Formatted string showing the status progression
        
    Example output:
        "New → Triaged by Alex → In Progress by Sara → Fixed → Verified by QA"
    """
    if not timeline:
        return "No status history"
    
    parts = []
    for entry in timeline:
        if entry.from_status:
            transition = f"{entry.to_status}"
        else:
            # Initial status
            transition = entry.to_status
        
        if entry.changed_by_user:
            transition += f" by {entry.changed_by_user.name}"
        
        parts.append(transition)
    
    return " → ".join(parts)
