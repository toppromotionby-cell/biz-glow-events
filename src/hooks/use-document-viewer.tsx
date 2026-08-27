// Провайдер просмотрщика документов: загружает файл с авторизацией и открывает диалог.
// Заменяет window.open после fetch — такой вызов блокируется браузером (особенно в iframe).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DocumentViewerDialog, type ViewerDoc } from "@/components/admin/DocumentViewerDialog";
import { documentFetchError } from "@/lib/document-fetch-error";
import { downloadBlob } from "@/lib/download";
import { expectedSignature, isPreviewableMime, matchesSignature } from "@/lib/document-mime";

type OpenOpts = {
  name?: string;
  auth?: boolean;
  /** «download» — сразу сохранить файл, «preview» — открыть диалог (по умолчанию авто по типу). */
  mode?: "preview" | "download";
};

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
      setDoc({ url, name, mime: blob.type, blob });
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
          throw new Error(documentFetchError(res.status, res.headers.get("x-document-error-id")));
        }
        const blob = await res.blob();
        const declaredType = (res.headers.get("content-type") ?? "").split(";", 1)[0].toLowerCase();
        const name = filenameFrom(res.headers.get("content-disposition") ?? "", opts.name ?? "document");

        if (blob.size === 0) throw new Error("Сервер вернул пустой файл. Повторите попытку");
        const signature = expectedSignature(declaredType, name);
        if (signature) {
          const head = new TextDecoder("latin1").decode(new Uint8Array(await blob.slice(0, signature.length).arrayBuffer()));
          if (!matchesSignature(head, signature)) {
            throw new Error("Сервер вернул повреждённый файл. Повторите попытку");
          }
        }

        const typed = declaredType && blob.type !== declaredType ? new Blob([blob], { type: declaredType }) : blob;
        const mode = opts.mode ?? (isPreviewableMime(declaredType) ? "preview" : "download");
        if (mode === "download") {
          await downloadBlob(typed, name, { fallbackUrl: url });
          toast.success(`Файл готов: ${name}`);
          return;
        }
        show(typed, name);
      } catch (e) {
        revoke();
        setDoc(null);
        const message = e instanceof TypeError
          ? "Сеть недоступна. Проверьте подключение и повторите попытку"
          : (e as Error).message;
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [revoke, show],
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
