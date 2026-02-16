"""
Utility functions for managing bug retests (connecting bugs to retest executions)

Usage example:
    from app.bug_retest_utils import record_retest, get_bug_retests
    
    # After executing a test to verify a bug fix
    retest = record_retest(
        db=db,
        bug_id=bug.id,
        test_execution_id=execution.id,
        result="passed",
        created_by_user_id=current_user.id
    )
    
    db.commit()
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime
from .models import BugRetest, BugReport, TestExecution


def record_retest(
    db: Session,
    bug_id: int,
    test_execution_id: int,
    result: str,
    created_by_user_id: int | None = None,
) -> BugRetest:
    """
    Record a bug retest execution.
    
    Args:
        db: Database session
        bug_id: ID of the bug being retested
        test_execution_id: ID of the test execution used for retesting
        result: Result of the retest (passed/failed/blocked/skipped)
        created_by_user_id: ID of user performing the retest (optional)
        
    Returns:
        The created BugRetest record
        
    Example:
        # Record successful retest
        retest = record_retest(
            db=db,
            bug_id=123,
            test_execution_id=456,
            result="passed",
            created_by_user_id=5
        )
        
        # Record failed retest (bug not fixed)
        retest = record_retest(
            db=db,
            bug_id=123,
            test_execution_id=457,
            result="failed",
            created_by_user_id=5
        )
    """
    # Validate result
    valid_results = ["passed", "failed", "blocked", "skipped"]
    if result not in valid_results:
        raise ValueError(f"Invalid result '{result}'. Must be one of: {valid_results}")
    
    retest = BugRetest(
        bug_id=bug_id,
        test_execution_id=test_execution_id,
        result=result,
        created_by_user_id=created_by_user_id,
    )
    
    db.add(retest)
    # Note: Caller should commit the transaction
    
    return retest


def get_bug_retests(db: Session, bug_id: int) -> list[BugRetest]:
    """
    Get all retest executions for a bug, ordered chronologically.
    
    Args:
        db: Database session
        bug_id: ID of the bug
        
    Returns:
        List of BugRetest records ordered by created_at
        
    Example:
        retests = get_bug_retests(db, bug_id=123)
        for retest in retests:
            print(f"{retest.created_at}: {retest.result}")
            print(f"  Test Execution ID: {retest.test_execution_id}")
            print(f"  Tested by: {retest.created_by_user.name}")
    """
    return (
        db.query(BugRetest)
        .filter(BugRetest.bug_id == bug_id)
        .order_by(BugRetest.created_at)
        .all()
    )


def get_retest_count(db: Session, bug_id: int) -> int:
    """
    Get the total number of retests for a bug.
    
    Args:
        db: Database session
        bug_id: ID of the bug
        
    Returns:
        Total count of retests
    """
    return db.query(BugRetest).filter(BugRetest.bug_id == bug_id).count()


def get_retest_stats(db: Session, bug_id: int) -> dict:
    """
    Get retest statistics for a bug.
    
    Args:
        db: Database session
        bug_id: ID of the bug
        
    Returns:
        Dictionary containing retest statistics
        
    Example:
        stats = get_retest_stats(db, bug_id=123)
        # Returns: {
        #     "total_retests": 3,
        #     "passed": 1,
        #     "failed": 2,
        #     "blocked": 0,
        #     "skipped": 0,
        #     "last_result": "passed",
        #     "last_tested_at": datetime(...),
        #     "verified": True
        # }
    """
    retests = get_bug_retests(db, bug_id)
    
    if not retests:
        return {
            "total_retests": 0,
            "passed": 0,
            "failed": 0,
            "blocked": 0,
            "skipped": 0,
            "last_result": None,
            "last_tested_at": None,
            "verified": False,
        }
    
    # Count by result
    result_counts = {"passed": 0, "failed": 0, "blocked": 0, "skipped": 0}
    for retest in retests:
        result_counts[retest.result] += 1
    
    last_retest = retests[-1]
    
    return {
        "total_retests": len(retests),
        "passed": result_counts["passed"],
        "failed": result_counts["failed"],
        "blocked": result_counts["blocked"],
        "skipped": result_counts["skipped"],
        "last_result": last_retest.result,
        "last_tested_at": last_retest.created_at,
        "verified": last_retest.result == "passed",
    }


def is_bug_verified(db: Session, bug_id: int) -> bool:
    """
    Check if a bug has been verified (last retest passed).
    
    Args:
        db: Database session
        bug_id: ID of the bug
        
    Returns:
        True if the most recent retest passed, False otherwise
    """
    last_retest = (
        db.query(BugRetest)
        .filter(BugRetest.bug_id == bug_id)
        .order_by(desc(BugRetest.created_at))
        .first()
    )
    
    return last_retest is not None and last_retest.result == "passed"


def should_reopen_bug(db: Session, bug_id: int) -> bool:
    """
    Check if a bug should be reopened based on retest failures.
    
    Args:
        db: Database session
        bug_id: ID of the bug
        
    Returns:
        True if the most recent retest failed, False otherwise
    """
    last_retest = (
        db.query(BugRetest)
        .filter(BugRetest.bug_id == bug_id)
        .order_by(desc(BugRetest.created_at))
        .first()
    )
    
    return last_retest is not None and last_retest.result == "failed"


def get_bugs_by_retest_status(
    db: Session, project_id: int | None = None, verified: bool = True
) -> list[int]:
    """
    Get bugs that are verified or unverified based on their retest status.
    
    Args:
        db: Database session
        project_id: Optional project ID to filter by
        verified: If True, get verified bugs; if False, get unverified bugs
        
    Returns:
        List of bug IDs
    """
    # Subquery to get the latest retest for each bug
    latest_retests = (
        db.query(
            BugRetest.bug_id,
            func.max(BugRetest.created_at).label("max_created_at")
        )
        .group_by(BugRetest.bug_id)
        .subquery()
    )
    
    # Join to get bugs with their latest retest result
    query = (
        db.query(BugRetest.bug_id)
        .join(
            latest_retests,
            (BugRetest.bug_id == latest_retests.c.bug_id) &
            (BugRetest.created_at == latest_retests.c.max_created_at)
        )
    )
    
    if verified:
        query = query.filter(BugRetest.result == "passed")
    else:
        query = query.filter(BugRetest.result != "passed")
    
    if project_id:
        query = query.join(BugReport).filter(BugReport.project_id == project_id)
    
    return [row[0] for row in query.all()]


def get_retests_by_user(
    db: Session, user_id: int, limit: int = 50
) -> list[BugRetest]:
    """
    Get recent retests performed by a specific user.
    
    Args:
        db: Database session
        user_id: ID of the user
        limit: Maximum number of records to return
        
    Returns:
        List of BugRetest records ordered by created_at (newest first)
    """
    return (
        db.query(BugRetest)
        .filter(BugRetest.created_by_user_id == user_id)
        .order_by(desc(BugRetest.created_at))
        .limit(limit)
        .all()
    )


def format_retest_summary(db: Session, bug_id: int) -> str:
    """
    Format a summary of bug retests.
    
    Args:
        db: Database session
        bug_id: ID of the bug
        
    Returns:
        Human-readable summary string
        
    Example output:
        "3 retests: Failed → Failed → Passed (Verified)"
    """
    retests = get_bug_retests(db, bug_id)
    
    if not retests:
        return "No retests"
    
    results = [r.result.capitalize() for r in retests]
    summary = f"{len(retests)} retest{'s' if len(retests) > 1 else ''}: {' → '.join(results)}"
    
    if retests[-1].result == "passed":
        summary += " (Verified)"
    elif retests[-1].result == "failed":
        summary += " (Needs Attention)"
    
    return summary
