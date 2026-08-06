import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getViewport: (options: { scale: number }) => { width: number; height: number };
    render: (options: { canvas: HTMLCanvasElement; canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void>; cancel: () => void };
  }>;
};

function PdfPage({ document, pageNumber }: { document: PdfDocumentProxy; pageNumber: number }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const update = () => setWidth(wrapper.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    setRendered(false);
    let active = true;
    let renderTask: { promise: Promise<void>; cancel: () => void } | null = null;

    void document.getPage(pageNumber).then((page) => {
      if (!active) return;
      const original = page.getViewport({ scale: 1 });
      const cssScale = Math.min(1.5, width / original.width);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: cssScale * pixelRatio });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / pixelRatio)}px`;
      canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;
      const context = canvas.getContext("2d");
      if (!context) return;
      renderTask = page.render({ canvas, canvasContext: context, viewport });
      return renderTask.promise.then(() => {
        if (active) setRendered(true);
      });
    }).catch((error) => {
      if (active && error instanceof Error && error.name !== "RenderingCancelledException") console.error("[pdf-preview] page render failed", error);
    });

    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [document, pageNumber, width]);

  return (
    <div ref={wrapperRef} className="flex w-full justify-center" aria-label={`Страница ${pageNumber}`}>
      <canvas ref={canvasRef} data-rendered={rendered ? "true" : "false"} className="max-w-full bg-background shadow-sm" />
    </div>
  );
}

export function PdfPreview({ blob }: { blob: Blob }) {
  const [document, setDocument] = useState<PdfDocumentProxy | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let loadingTask: { promise: Promise<unknown>; destroy: () => Promise<void> } | null = null;
    void (async () => {
      try {
        const mapPrototype = Map.prototype as Map<unknown, unknown> & {
          getOrInsertComputed?: (key: unknown, callback: (key: unknown) => unknown) => unknown;
        };
        if (!mapPrototype.getOrInsertComputed) {
          Object.defineProperty(mapPrototype, "getOrInsertComputed", {
            configurable: true,
            value(this: Map<unknown, unknown>, key: unknown, callback: (key: unknown) => unknown) {
              if (this.has(key)) return this.get(key);
              const value = callback(key);
              this.set(key, value);
              return value;
            },
          });
        }
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        loadingTask = pdfjs.getDocument({ data: bytes });
        const loadedDocument = await loadingTask.promise as PdfDocumentProxy;
        if (active) setDocument(loadedDocument);
        else await loadingTask.destroy();
      } catch (loadError) {
        console.error("[pdf-preview] document load failed", loadError);
        if (active) setError(true);
      }
    })();
    return () => {
      active = false;
      if (loadingTask) void loadingTask.destroy();
    };
  }, [blob]);

  if (error) {
    return (
      <div className="flex h-[40vh] flex-col items-center justify-center gap-2 text-sm text-destructive">
        <AlertCircle className="h-5 w-5" />
        Не удалось отобразить PDF. Скачайте файл для просмотра.
      </div>
    );
  }
  if (!document) {
    return <div className="flex h-[40vh] items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Открываем PDF…</div>;
  }

  return (
    <div className="h-[76vh] overflow-auto bg-muted p-3 sm:p-5">
      <div className="mx-auto flex max-w-[900px] flex-col gap-4">
        {Array.from({ length: document.numPages }, (_, index) => <PdfPage key={index + 1} document={document} pageNumber={index + 1} />)}
      </div>
    </div>
  );
}