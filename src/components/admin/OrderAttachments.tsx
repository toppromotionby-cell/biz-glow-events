// Прикреплённые к заявке файлы (счета, договоры, любые документы).
// Загрузка/удаление через supabase client (RLS для staff). Открытие — signed URL.
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trash2, Download, Paperclip } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "order-attachments";
const KIND_LABEL: Record<string, string> = { invoice: "Счёт", contract: "Договор", custom: "Файл" };

function formatSize(n?: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function OrderAttachments({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["order-attachments", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_attachments")
        .select("*").eq("order_id", orderId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleUpload = async (file: File, kind: "invoice" | "contract" | "custom") => {
    setUploading(true);
    try {
      const ts = Date.now();
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${orderId}/${kind}-${ts}-${safe}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: userRes } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("order_attachments").insert({
        order_id: orderId, kind, file_path: path, file_name: file.name,
        file_size: file.size, mime_type: file.type || null,
        created_by: userRes.user?.id ?? null,
      });
      if (insErr) throw insErr;
      await supabase.from("order_timeline").insert({
        order_id: orderId, event: "attachment_added", payload: { kind, file_name: file.name },
      });
      toast.success("Файл загружен");
      qc.invalidateQueries({ queryKey: ["order-attachments", orderId] });
      qc.invalidateQueries({ queryKey: ["order-timeline", orderId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleUpload(f, "custom");
  };

  const generatePdf = async (kind: "invoice" | "contract") => {
    try {
      await openAuthedDocument(`/admin/orders/${orderId}/${kind}`);
      toast.info(`${KIND_LABEL[kind]}: используйте «Сохранить как PDF» через печать (Ctrl+P)`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const attachGenerated = async (kind: "invoice" | "contract") => {
    setUploading(true);
    try {
      const html = await fetchAuthedDocument(`/admin/orders/${orderId}/${kind}`);
      const blob = new Blob([html], { type: "text/html" });
      const file = new File([blob], `${KIND_LABEL[kind].toLowerCase()}-${orderId.slice(0, 8)}.html`, { type: "text/html" });
      await handleUpload(file, kind);
    } catch (e) {
      toast.error((e as Error).message);
      setUploading(false);
    }
  };

  const del = useMutation({
    mutationFn: async (row: { id: string; file_path: string }) => {
      await supabase.storage.from(BUCKET).remove([row.file_path]);
      const { error } = await supabase.from("order_attachments").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Удалено");
      qc.invalidateQueries({ queryKey: ["order-attachments", orderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = async (row: { file_path: string; file_name: string }) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(row.file_path, 600);
    if (error) return toast.error(error.message);
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = row.file_name;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold flex items-center gap-2"><Paperclip className="h-4 w-4" />Документы и файлы</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => generatePdf("invoice")}><FileText className="h-4 w-4 mr-1.5" />Открыть счёт</Button>
          <Button size="sm" variant="outline" onClick={() => generatePdf("contract")}><FileText className="h-4 w-4 mr-1.5" />Открыть договор</Button>
          <Button size="sm" variant="secondary" disabled={uploading} onClick={() => attachGenerated("invoice")}>Прикрепить счёт</Button>
          <Button size="sm" variant="secondary" disabled={uploading} onClick={() => attachGenerated("contract")}>Прикрепить договор</Button>
          <input ref={fileRef} type="file" hidden onChange={onPickFile} />
          <Button size="sm" disabled={uploading} onClick={() => fileRef.current?.click()} className="bg-gradient-primary glow-primary">
            <Upload className="h-4 w-4 mr-1.5" />{uploading ? "Загрузка..." : "Загрузить файл"}
          </Button>
        </div>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Файлов пока нет. Сгенерируйте счёт/договор или загрузите файл.</p>
      ) : (
        <ul className="divide-y divide-border/30">
          {items.map((it) => (
            <li key={it.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{it.file_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {KIND_LABEL[it.kind] ?? it.kind} · {formatSize(it.file_size)} · {new Date(it.created_at).toLocaleString("ru-BY")}
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => download(it)} title="Скачать"><Download className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("Удалить файл?")) del.mutate(it); }} title="Удалить">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
