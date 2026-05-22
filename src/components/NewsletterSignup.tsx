// Подписка на рассылку в футере.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mail, Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { subscribeNewsletter } from "@/lib/newsletter.functions";
import { toast } from "sonner";

export function NewsletterSignup({ source = "footer" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const m = useMutation({
    mutationFn: () => subscribeNewsletter({ data: { email, source } }),
    onSuccess: () => {
      setDone(true);
      setEmail("");
      toast.success("Подписка оформлена!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = /.+@.+\..+/.test(email);

  if (done) {
    return (
      <div className="flex items-center gap-2 text-sm text-success">
        <Check className="h-4 w-4" /> Спасибо! Письмо с подтверждением скоро придёт.
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (valid) m.mutate(); }}
      className="flex flex-col sm:flex-row gap-2"
    >
      <div className="relative flex-1">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ваш@email.by"
          className="pl-9"
          aria-label="Email для рассылки"
        />
      </div>
      <Button type="submit" disabled={!valid || m.isPending} className="bg-gradient-primary glow-primary">
        {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Подписаться"}
      </Button>
    </form>
  );
}
