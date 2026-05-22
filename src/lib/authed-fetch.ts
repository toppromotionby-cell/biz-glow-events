// Открыть auth-защищённый HTML server route в новой вкладке через blob URL.
// Передаёт Authorization bearer токен, иначе сервер вернёт 401.
import { supabase } from "@/integrations/supabase/client";

export async function openAuthedDocument(url: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Требуется вход");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Не удалось получить документ (${res.status})`);
  const html = await res.text();
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);
  const win = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (!win) throw new Error("Браузер заблокировал окно");
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export async function fetchAuthedDocument(url: string): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Требуется вход");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Не удалось получить документ (${res.status})`);
  return res.text();
}
