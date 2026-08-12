-- Путь файла вложения: <account_id>/<message_id>/<filename>
CREATE OR REPLACE FUNCTION private.owns_mail_attachment_object(_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_account uuid;
BEGIN
  BEGIN
    v_account := (storage.foldername(_name))[1]::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  IF v_account IS NULL THEN
    RETURN false;
  END IF;
  RETURN private.owns_mail_account(v_account);
END;
$$;

REVOKE ALL ON FUNCTION private.owns_mail_attachment_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.owns_mail_attachment_object(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Mailbox owner reads mail attachments" ON storage.objects;
CREATE POLICY "Mailbox owner reads mail attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mail-attachments' AND private.owns_mail_attachment_object(name));

DROP POLICY IF EXISTS "Mailbox owner uploads mail attachments" ON storage.objects;
CREATE POLICY "Mailbox owner uploads mail attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mail-attachments' AND private.owns_mail_attachment_object(name));

DROP POLICY IF EXISTS "Mailbox owner updates mail attachments" ON storage.objects;
CREATE POLICY "Mailbox owner updates mail attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'mail-attachments' AND private.owns_mail_attachment_object(name))
  WITH CHECK (bucket_id = 'mail-attachments' AND private.owns_mail_attachment_object(name));

DROP POLICY IF EXISTS "Mailbox owner deletes mail attachments" ON storage.objects;
CREATE POLICY "Mailbox owner deletes mail attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mail-attachments' AND private.owns_mail_attachment_object(name));