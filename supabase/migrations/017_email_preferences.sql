-- Add email preferences to profiles
-- Allows users to opt-in/out of various email communications

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email_digest_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_digest_frequency TEXT DEFAULT 'weekly' CHECK (email_digest_frequency IN ('daily', 'weekly', 'monthly', 'never')),
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ;

-- Index for finding users who need digest emails
CREATE INDEX IF NOT EXISTS idx_profiles_digest_enabled
ON profiles(email_digest_enabled, email_digest_frequency)
WHERE email_digest_enabled = true;

COMMENT ON COLUMN profiles.email_digest_enabled IS 'Whether user receives reading digest emails';
COMMENT ON COLUMN profiles.email_digest_frequency IS 'How often to send digest: daily, weekly, monthly, or never';
COMMENT ON COLUMN profiles.email_notifications_enabled IS 'Whether user receives notification emails (new follower, etc.)';
COMMENT ON COLUMN profiles.last_digest_sent_at IS 'When the last digest email was sent to this user';
