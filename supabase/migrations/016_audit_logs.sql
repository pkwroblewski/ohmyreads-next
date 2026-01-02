-- Audit Logs Table
-- Tracks sensitive actions for compliance and debugging

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who performed the action
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- What action was performed
  action TEXT NOT NULL,
  -- e.g., 'moderation.book.approve', 'moderation.book.reject',
  --       'moderation.place.approve', 'admin.user.ban', 'user.delete_account'

  -- What type of entity was affected
  target_type TEXT NOT NULL,
  -- e.g., 'book_submission', 'place_submission', 'user', 'review', 'comment'

  -- ID of the affected entity
  target_id TEXT,

  -- Additional context (JSON)
  metadata JSONB DEFAULT '{}',

  -- IP address (for security auditing)
  ip_address TEXT,

  -- User agent (for security auditing)
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

-- Index for querying by action type
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Index for querying by target
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);

-- Index for time-based queries (recent activity)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- RLS Policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "Admins can read audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- No one can update or delete audit logs (immutable)
-- Insert is done via service role only

-- Grant necessary permissions
GRANT SELECT ON audit_logs TO authenticated;

-- Comment for documentation
COMMENT ON TABLE audit_logs IS 'Immutable audit trail for sensitive actions. Only admins can read, only service role can insert.';
