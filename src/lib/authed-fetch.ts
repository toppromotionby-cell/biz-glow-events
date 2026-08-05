// Хелперы для auth-защищённых документов.
// Открытие/показ документов делает DocumentViewerProvider (см. @/hooks/use-document-viewer),
// поэтому здесь нет window.open — браузер блокирует его после асинхронного fetch.
import { supabase } from "@/integrations/supabase/client";
import { documentFetchError } from "@/lib/document-fetch-error";

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function fetchAuthedDocument(url: string): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Требуется вход");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(documentFetchError(res.status, res.headers.get("x-document-error-id")));
  return res.text();
}

export async function fetchAuthedDocumentBlob(url: string): Promise<Blob> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Требуется вход");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(documentFetchError(res.status, res.headers.get("x-document-error-id")));
  return res.blob();
}
