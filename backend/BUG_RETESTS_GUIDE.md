# Bug Retests - Quick Start Guide

## Overview
The `bug_retests` table tracks retest executions after bugs are fixed, allowing you to:
- Connect bugs to test executions used for retesting
- Track how many retests were needed before verification
- Know when a bug was verified or needs to be reopened

## Database Setup

Run the SQL migration:
```bash
psql -U your_user -d your_database -f backend/sql_scripts/create_bug_retests.sql
```

## Quick Usage Examples

### 1. Record a Retest After Test Execution

```python
from app.bug_retest_utils import record_retest

@router.post("/test_executions/{execution_id}/link_bug_retest")
async def link_bug_retest(
    execution_id: int,
    bug_id: int,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    """Link a test execution as a bug retest."""
    
    # Get the execution
    execution = await db.get(TestExecution, execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    # Get the bug
    bug = await db.get(BugReport, bug_id)
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")
    
    # Record the retest
    retest = record_retest(
        db=db,
        bug_id=bug_id,
        test_execution_id=execution_id,
        result=execution.result,  # Use execution's result
        created_by_user_id=user.id
    )
    
    await db.commit()
    await db.refresh(retest)
    
    return {"status": "retest recorded", "retest_id": retest.id}
```

### 2. Auto-Record Retest When Executing a Bug-Related Test

```python
from app.bug_retest_utils import record_retest
from app.bug_status_history_utils import record_status_change

@router.post("/test_executions/execute")
async def execute_test(
    payload: ExecuteTestIn,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    """Execute a test case and auto-link if it's a bug retest."""
    
    # Create test execution
    execution = TestExecution(**payload.model_dump(), executed_by_user_id=user.id)
    db.add(execution)
    await db.flush()
    
    # If this test is retesting a specific bug
    if payload.retesting_bug_id:
        bug = await db.get(BugReport, payload.retesting_bug_id)
        
        # Record the retest
        record_retest(
            db=db,
            bug_id=payload.retesting_bug_id,
            test_execution_id=execution.id,
            result=payload.result,
            created_by_user_id=user.id
        )
        
        # Update bug status based on result
        old_status = bug.status
        if payload.result == "passed":
            bug.status = "verified"
            record_status_change(
                db=db,
                bug_id=bug.id,
                from_status=old_status,
                to_status="verified",
                changed_by_user_id=user.id,
                comment="Bug verified by passing retest"
            )
        elif payload.result == "failed":
            bug.status = "reopened"
            record_status_change(
                db=db,
                bug_id=bug.id,
                from_status=old_status,
                to_status="reopened",
                changed_by_user_id=user.id,
                comment="Bug failed retest - reopening"
            )
    
    await db.commit()
    return execution
```

### 3. Get Bug Retest History

```python
from app.bug_retest_utils import get_bug_retests, get_retest_stats, format_retest_summary

@router.get("/bug_reports/{bug_id}/retests")
async def get_bug_retests_endpoint(
    bug_id: int,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    """Get complete retest history for a bug."""
    
    bug = await db.get(BugReport, bug_id)
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")
    
    # Get retests and stats
    retests = get_bug_retests(db, bug_id)
    stats = get_retest_stats(db, bug_id)
    summary = format_retest_summary(db, bug_id)
    
    return {
        "bug_id": bug_id,
        "retests": [
            {
                "id": r.id,
                "test_execution_id": r.test_execution_id,
                "result": r.result,
                "created_by": r.created_by_user.name if r.created_by_user else None,
                "created_at": r.created_at
            }
            for r in retests
        ],
        "stats": stats,
        "formatted_summary": summary
    }
```

### 4. Get Verification Status

```python
from app.bug_retest_utils import is_bug_verified, should_reopen_bug

@router.get("/bug_reports/{bug_id}/verification_status")
async def get_verification_status(
    bug_id: int,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    """Check if bug is verified or needs attention."""
    
    verified = is_bug_verified(db, bug_id)
    needs_reopen = should_reopen_bug(db, bug_id)
    
    return {
        "bug_id": bug_id,
        "verified": verified,
        "needs_reopening": needs_reopen
    }
```

### 5. Dashboard: Get All Verified/Unverified Bugs

```python
from app.bug_retest_utils import get_bugs_by_retest_status

@router.get("/projects/{project_id}/verified_bugs")
async def get_verified_bugs(
    project_id: int,
    verified: bool = True,
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(get_current_user),
):
    """Get bugs that have been verified or are waiting for verification."""
    
    bug_ids = get_bugs_by_retest_status(db, project_id=project_id, verified=verified)
    
    bugs = await db.execute(
        select(BugReport).where(BugReport.id.in_(bug_ids))
    )
    
    return {
        "project_id": project_id,
        "verified": verified,
        "count": len(bug_ids),
        "bugs": bugs.scalars().all()
    }
```

## Frontend Integration

```javascript
// Record a retest when executing a test
async function executeTestForBug(testCaseId, bugId, result) {
    const response = await fetch('/api/test_executions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            test_case_id: testCaseId,
            retesting_bug_id: bugId,
            result: result
        })
    });
    return await response.json();
}

// Get bug retest history
async function getBugRetestHistory(bugId) {
    const response = await fetch(`/api/bug_reports/${bugId}/retests`);
    const data = await response.json();
    
    console.log(data.formatted_summary);
    // Output: "3 retests: Failed → Failed → Passed (Verified)"
    
    return data;
}

// Display retest history in UI
function renderRetestHistory(retests) {
    return retests.map(retest => `
        <div class="retest-entry ${retest.result}">
            <span class="badge">${retest.result.toUpperCase()}</span>
            <span class="user">${retest.created_by}</span>
            <span class="date">${new Date(retest.created_at).toLocaleString()}</span>
            <a href="/test_executions/${retest.test_execution_id}">View Execution</a>
        </div>
    `).join('');
}

// Badge color based on verification status
function getVerificationBadge(stats) {
    if (stats.verified) {
        return '<span class="badge badge-success">✓ Verified</span>';
    } else if (stats.last_result === 'failed') {
        return '<span class="badge badge-danger">✗ Failed Retest</span>';
    } else {
        return '<span class="badge badge-warning">⧗ Awaiting Retest</span>';
    }
}
```

## Common Queries

### Get bugs that need retesting (fixed but not verified)
```python
bugs_needing_retest = db.query(BugReport).filter(
    BugReport.status == "fixed",
    ~BugReport.id.in_(
        db.query(BugRetest.bug_id)
        .filter(BugRetest.result == "passed")
        .subquery()
    )
).all()
```

### Get average time to verification
```python
from sqlalchemy import func

avg_time = db.query(
    func.avg(
        func.extract('epoch', BugRetest.created_at - BugReport.created_at)
    ).label('avg_seconds')
).join(BugReport).filter(BugRetest.result == "passed").scalar()

avg_days = avg_time / 86400 if avg_time else 0
```

### Get most active testers
```python
top_testers = db.query(
    User.name,
    func.count(BugRetest.id).label('retest_count')
).join(BugRetest).group_by(User.name)\
.order_by(func.count(BugRetest.id).desc())\
.limit(10).all()
```

## Best Practices

1. **Always record retests** when executing tests for bug verification
2. **Link test executions** to bugs for full traceability
3. **Update bug status** automatically based on retest results
4. **Show retest history** in bug detail views
5. **Use for metrics** like verification rate, time-to-verify, etc.

## Example Workflow

1. Developer fixes bug → Status: `fixed`
2. QA executes test → Record retest with execution
3. Test fails → Status: `reopened`, retest recorded as `failed`
4. Developer fixes again → Status: `fixed`
5. QA retests → Record another retest
6. Test passes → Status: `verified`, retest recorded as `passed`

This creates a complete audit trail of the verification process!
