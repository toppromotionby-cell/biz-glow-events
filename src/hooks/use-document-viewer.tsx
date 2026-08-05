// Провайдер просмотрщика документов: загружает файл с авторизацией и открывает диалог.
// Заменяет window.open после fetch — такой вызов блокируется браузером (особенно в iframe).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DocumentViewerDialog, type ViewerDoc } from "@/components/admin/DocumentViewerDialog";

type OpenOpts = { name?: string; auth?: boolean };

type Ctx = {
  /** Загрузить документ по URL (с bearer-токеном) и показать в диалоге. */
  openDocument: (url: string, opts?: OpenOpts) => Promise<void>;
  /** Показать уже готовые байты/строку (например, превью письма или base64-PDF). */
  openBlob: (data: Uint8Array | string, mime: string, name: string) => void;
  loading: boolean;
};

const ViewerContext = createContext<Ctx | null>(null);

function filenameFrom(cd: string, fallback: string): string {
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd)?.[1];
  const plain = /filename="([^"]+)"/i.exec(cd)?.[1];
  return star ? decodeURIComponent(star) : plain || fallback;
}

export function DocumentViewerProvider({ children }: { children: ReactNode }) {
  const [doc, setDoc] = useState<ViewerDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const urlRef = useRef<string | null>(null);

  const revoke = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  useEffect(() => revoke, [revoke]);

  const show = useCallback(
    (blob: Blob, name: string) => {
      revoke();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setDoc({ url, name, mime: blob.type });
    },
    [revoke],
  );

  const openBlob = useCallback(
    (data: Uint8Array | string, mime: string, name: string) => {
      const blob = typeof data === "string" ? new Blob([data], { type: mime }) : new Blob([data as BlobPart], { type: mime });
      show(blob, name);
    },
    [show],
  );

  const openDocument = useCallback(
    async (url: string, opts: OpenOpts = {}) => {
      setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (opts.auth !== false) {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (!token) throw new Error("Требуется вход");
          headers["Authorization"] = `Bearer ${token}`;
        }
        const res = await fetch(url, { headers });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          const short = detail.replace(/<[^>]*>/g, " ").trim().slice(0, 160);
          throw new Error(`Не удалось получить документ (${res.status})${short ? `: ${short}` : ""}`);
        }
        const blob = await res.blob();
        const name = filenameFrom(res.headers.get("content-disposition") ?? "", opts.name ?? "document");
        show(blob, name);
      } catch (e) {
        setDoc(null);
        toast.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [show],
  );

  const close = (open: boolean) => {
    if (open) return;
    setDoc(null);
    setLoading(false);
    revoke();
  };

  return (
    <ViewerContext.Provider value={{ openDocument, openBlob, loading }}>
      {children}
      <DocumentViewerDialog doc={doc} loading={loading} onOpenChange={close} />
    </ViewerContext.Provider>
  );
}

export function useDocumentViewer(): Ctx {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error("useDocumentViewer должен использоваться внутри DocumentViewerProvider");
  return ctx;
}
