
-- ============ MAIL ACCOUNTS ============
CREATE TABLE public.mail_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  provider TEXT NOT NULL DEFAULT 'imap',
  nylas_grant_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  last_sync_at TIMESTAMPTZ,
  last_sync_cursor TEXT,
  sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mail_accounts_owner ON public.mail_accounts(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_accounts TO authenticated;
GRANT ALL ON public.mail_accounts TO service_role;
ALTER TABLE public.mail_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view mail accounts" ON public.mail_accounts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Staff can insert mail accounts" ON public.mail_accounts
  FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) AND owner_id = auth.uid());
CREATE POLICY "Staff can update mail accounts" ON public.mail_accounts
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Staff can delete mail accounts" ON public.mail_accounts
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER trg_mail_accounts_updated
  BEFORE UPDATE ON public.mail_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ MAIL FOLDERS ============
CREATE TABLE public.mail_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.mail_accounts(id) ON DELETE CASCADE,
  nylas_folder_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'custom',
  unread_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  parent_id UUID REFERENCES public.mail_folders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, nylas_folder_id)
);
CREATE INDEX idx_mail_folders_account ON public.mail_folders(account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_folders TO authenticated;
GRANT ALL ON public.mail_folders TO service_role;
ALTER TABLE public.mail_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage mail folders" ON public.mail_folders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER trg_mail_folders_updated
  BEFORE UPDATE ON public.mail_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ MAIL MESSAGES ============
CREATE TABLE public.mail_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.mail_accounts(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.mail_folders(id) ON DELETE SET NULL,
  nylas_message_id TEXT NOT NULL,
  nylas_thread_id TEXT,
  from_addr TEXT,
  from_name TEXT,
  to_addrs JSONB NOT NULL DEFAULT '[]'::jsonb,
  cc_addrs JSONB NOT NULL DEFAULT '[]'::jsonb,
  bcc_addrs JSONB NOT NULL DEFAULT '[]'::jsonb,
  reply_to JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject TEXT,
  snippet TEXT,
  body_html TEXT,
  body_text TEXT,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen BOOLEAN NOT NULL DEFAULT false,
  starred BOOLEAN NOT NULL DEFAULT false,
  has_attachments BOOLEAN NOT NULL DEFAULT false,
  size_bytes INTEGER,
  raw_headers JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, nylas_message_id)
);
CREATE INDEX idx_mail_messages_folder_received ON public.mail_messages(folder_id, received_at DESC);
CREATE INDEX idx_mail_messages_account_received ON public.mail_messages(account_id, received_at DESC);
CREATE INDEX idx_mail_messages_thread ON public.mail_messages(nylas_thread_id);
CREATE INDEX idx_mail_messages_search ON public.mail_messages
  USING GIN (to_tsvector('simple', coalesce(subject,'') || ' ' || coalesce(from_addr,'') || ' ' || coalesce(body_text,'')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_messages TO authenticated;
GRANT ALL ON public.mail_messages TO service_role;
ALTER TABLE public.mail_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage mail messages" ON public.mail_messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER trg_mail_messages_updated
  BEFORE UPDATE ON public.mail_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ MAIL ATTACHMENTS ============
CREATE TABLE public.mail_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.mail_messages(id) ON DELETE CASCADE,
  nylas_attachment_id TEXT,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  storage_path TEXT,
  content_id TEXT,
  is_inline BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mail_attachments_message ON public.mail_attachments(message_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_attachments TO authenticated;
GRANT ALL ON public.mail_attachments TO service_role;
ALTER TABLE public.mail_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage mail attachments" ON public.mail_attachments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- ============ MAIL DRAFTS ============
CREATE TABLE public.mail_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.mail_accounts(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nylas_draft_id TEXT,
  subject TEXT,
  to_addrs JSONB NOT NULL DEFAULT '[]'::jsonb,
  cc_addrs JSONB NOT NULL DEFAULT '[]'::jsonb,
  bcc_addrs JSONB NOT NULL DEFAULT '[]'::jsonb,
  body_html TEXT,
  in_reply_to TEXT,
  reply_to_message_id UUID REFERENCES public.mail_messages(id) ON DELETE SET NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mail_drafts_account ON public.mail_drafts(account_id);
CREATE INDEX idx_mail_drafts_owner ON public.mail_drafts(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_drafts TO authenticated;
GRANT ALL ON public.mail_drafts TO service_role;
ALTER TABLE public.mail_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage mail drafts" ON public.mail_drafts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER trg_mail_drafts_updated
  BEFORE UPDATE ON public.mail_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ MAIL RULES ============
CREATE TABLE public.mail_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.mail_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  action JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mail_rules_account ON public.mail_rules(account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_rules TO authenticated;
GRANT ALL ON public.mail_rules TO service_role;
ALTER TABLE public.mail_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage mail rules" ON public.mail_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER trg_mail_rules_updated
  BEFORE UPDATE ON public.mail_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
