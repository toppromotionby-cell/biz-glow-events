// Диалог обсуждения трека / софта / темы клуба.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { djAddComment, djListComments } from "@/lib/dj/dj.functions";

type TargetType = "track" | "software" | "thread";

export function CommentsDialog({
  open, onOpenChange, targetType, targetId, title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: TargetType;
  targetId: string;
  title: string;
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const key = ["dj", "comments", targetType, targetId];

  const { data: comments = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => djListComments({ data: { targetType, targetId } }),
    enabled: open,
  });

  const add = useMutation({
    mutationFn: () => djAddComment({ data: { targetType, targetId, body } }),
    onSuccess: () => {
      setBody("");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="truncate">{title}</DialogTitle>
          <DialogDescription>Обсуждение для участников клуба</DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Пока нет комментариев — напишите первым.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{c.author_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{c.body}</p>
              </div>
            ))
          )}
        </div>

        <div className="flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ваш комментарий…"
            rows={2}
            maxLength={4000}
          />
          <Button
            onClick={() => add.mutate()}
            disabled={!body.trim() || add.isPending}
            aria-label="Отправить комментарий"
          >
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
