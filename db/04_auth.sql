-- Adds login/reset-password support to sg.app_user.
ALTER TABLE sg.app_user
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS reset_token_hash text,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS app_user_email_key
  ON sg.app_user (lower(email))
  WHERE email IS NOT NULL;
