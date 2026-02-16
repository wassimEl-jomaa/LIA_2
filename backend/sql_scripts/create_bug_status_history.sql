-- Migration: Add bug_status_history table for audit trail
-- Created: 2026-02-16
-- Description: Track all status changes for bug reports with user attribution

CREATE TABLE IF NOT EXISTS bug_status_history (
    id SERIAL PRIMARY KEY,
    bug_id INTEGER NOT NULL,
    from_status VARCHAR(30),  -- NULL for initial status
    to_status VARCHAR(30) NOT NULL,
    changed_by_user_id INTEGER,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Foreign keys
    CONSTRAINT fk_bug_status_history_bug_id 
        FOREIGN KEY (bug_id) 
        REFERENCES bug_reports(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_bug_status_history_user_id 
        FOREIGN KEY (changed_by_user_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bug_status_history_bug_id ON bug_status_history(bug_id);
CREATE INDEX IF NOT EXISTS idx_bug_status_history_user_id ON bug_status_history(changed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_bug_status_history_created_at ON bug_status_history(created_at);

-- Comment on table
COMMENT ON TABLE bug_status_history IS 'Audit trail for bug report status changes';
COMMENT ON COLUMN bug_status_history.from_status IS 'Previous status (NULL for initial status)';
COMMENT ON COLUMN bug_status_history.to_status IS 'New status after change';
COMMENT ON COLUMN bug_status_history.changed_by_user_id IS 'User who made the status change';
COMMENT ON COLUMN bug_status_history.comment IS 'Optional comment explaining the status change';
