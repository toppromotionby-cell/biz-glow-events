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

// Открыть произвольный blob (HTML/PDF/…) в новой вкладке как полную страницу.
// Используется для превью писем и PDF — data: URL ненадёжно открывается через window.open
// (особенно крупные base64-PDF). Blob URL работает стабильно во всех браузерах.
export function openInlineBlob(bytes: Uint8Array | string, mime: string): void {
  const blob = typeof bytes === "string"
    ? new Blob([bytes], { type: mime })
    : new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error("Браузер заблокировал окно");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

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
  if (!res.ok) throw new Error(`Не удалось получить документ (${res.status})`);
  return res.text();
}

function inIframe(): boolean {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}

// Скачать auth-защищённый файл (PDF) с сохранением имени из Content-Disposition.
// Внутри iframe (предпросмотр Lovable) браузер блокирует <a download>, поэтому
// открываем документ в новой вкладке — оттуда его можно сохранить.
export async function downloadAuthedFile(url: string, fallbackName = "document.pdf"): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Требуется вход");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const short = detail.replace(/<[^>]*>/g, " ").trim().slice(0, 160);
    throw new Error(`Не удалось получить файл (${res.status})${short ? `: ${short}` : ""}`);
  }
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd)?.[1];
  const plain = /filename="([^"]+)"/i.exec(cd)?.[1];
  const name = star ? decodeURIComponent(star) : plain || fallbackName;
  const href = URL.createObjectURL(blob);

  if (inIframe()) {
    const win = window.open(href, "_blank", "noopener,noreferrer");
    if (!win) {
      URL.revokeObjectURL(href);
      throw new Error("Браузер заблокировал новое окно — разрешите всплывающие окна и повторите");
    }
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
    return;
  }

  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 30_000);
}
