
-- Reshape mail_accounts for IMAP/SMTP
ALTER TABLE public.mail_accounts
  DROP COLUMN IF EXISTS nylas_grant_id,
  ADD COLUMN imap_host TEXT,
  ADD COLUMN imap_port INTEGER NOT NULL DEFAULT 993,
  ADD COLUMN imap_secure BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN smtp_host TEXT,
  ADD COLUMN smtp_port INTEGER NOT NULL DEFAULT 465,
  ADD COLUMN smtp_secure BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN username TEXT,
  ADD COLUMN password_encrypted TEXT;

ALTER TABLE public.mail_accounts
  ALTER COLUMN provider SET DEFAULT 'imap';

-- mail_folders: rename nylas_folder_id -> remote_id, add uidvalidity
ALTER TABLE public.mail_folders
  RENAME COLUMN nylas_folder_id TO remote_id;
ALTER TABLE public.mail_folders
  ADD COLUMN uidvalidity BIGINT,
  ADD COLUMN uidnext BIGINT;

-- mail_messages: rename nylas_message_id -> remote_uid (text to fit imap uid as string), add imap_uid bigint + flags
ALTER TABLE public.mail_messages
  RENAME COLUMN nylas_message_id TO remote_id;
ALTER TABLE public.mail_messages
  RENAME COLUMN nylas_thread_id TO remote_thread_id;
ALTER TABLE public.mail_messages
  ADD COLUMN imap_uid BIGINT,
  ADD COLUMN flags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE INDEX IF NOT EXISTS idx_mail_messages_imap_uid ON public.mail_messages(folder_id, imap_uid);

-- mail_attachments: rename nylas_attachment_id -> remote_id
ALTER TABLE public.mail_attachments
  RENAME COLUMN nylas_attachment_id TO remote_id;

-- mail_drafts: rename nylas_draft_id -> remote_id
ALTER TABLE public.mail_drafts
  RENAME COLUMN nylas_draft_id TO remote_id;
