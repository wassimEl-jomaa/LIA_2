-- Migration: Add bug_retests table
-- Created: 2026-02-16
-- Description: Track retest executions for bugs after they've been fixed

CREATE TABLE IF NOT EXISTS bug_retests (
    id SERIAL PRIMARY KEY,
    bug_id INTEGER NOT NULL,
    test_execution_id INTEGER NOT NULL,
    result VARCHAR(20) NOT NULL,  -- passed/failed/blocked/skipped
    created_by_user_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Foreign keys
    CONSTRAINT fk_bug_retests_bug_id 
        FOREIGN KEY (bug_id) 
        REFERENCES bug_reports(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_bug_retests_test_execution_id 
        FOREIGN KEY (test_execution_id) 
        REFERENCES test_executions(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_bug_retests_user_id 
        FOREIGN KEY (created_by_user_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL,
    
    -- Ensure valid result values
    CONSTRAINT chk_bug_retests_result 
        CHECK (result IN ('passed', 'failed', 'blocked', 'skipped'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bug_retests_bug_id ON bug_retests(bug_id);
CREATE INDEX IF NOT EXISTS idx_bug_retests_test_execution_id ON bug_retests(test_execution_id);
CREATE INDEX IF NOT EXISTS idx_bug_retests_user_id ON bug_retests(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_bug_retests_created_at ON bug_retests(created_at);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_bug_retests_bug_result ON bug_retests(bug_id, result);

-- Comments on table
COMMENT ON TABLE bug_retests IS 'Tracks retest executions for bugs after they have been fixed';
COMMENT ON COLUMN bug_retests.bug_id IS 'Bug being retested';
COMMENT ON COLUMN bug_retests.test_execution_id IS 'Test execution used for retesting';
COMMENT ON COLUMN bug_retests.result IS 'Result of the retest (passed/failed/blocked/skipped)';
COMMENT ON COLUMN bug_retests.created_by_user_id IS 'User who performed the retest';
