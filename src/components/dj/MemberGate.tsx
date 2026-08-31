// Гейт доступа к закрытой части DJ-клуба: авторизация → заявка → модерация.
import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, Clock, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { djApply, djMyAccess } from "@/lib/dj/dj.functions";

export const DJ_ACCESS_KEY = ["dj", "access"];

export function useDjAccess() {
  const { isAuthenticated, loading } = useAuth();
  const query = useQuery({
    queryKey: DJ_ACCESS_KEY,
    queryFn: () => djMyAccess(),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  return { ...query, authLoading: loading, isAuthenticated };
}

export function MemberGate({ children }: { children: ReactNode }) {
  const { data, isLoading, authLoading, isAuthenticated } = useDjAccess();

  if (authLoading || (isAuthenticated && isLoading)) {
    return <Centered><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></Centered>;
  }

  if (!isAuthenticated) {
    return (
      <Card
        icon={<Lock className="h-6 w-6" />}
        title="Вход для DJ"
        text="Закрытая часть клуба доступна после входа в аккаунт. Регистрация занимает минуту."
      >
        <Button asChild><Link to="/login">Войти или зарегистрироваться</Link></Button>
      </Card>
    );
  }

  if (data?.isMember) return <>{children}</>;

  if (data?.status === "pending") {
    return (
      <Card icon={<Clock className="h-6 w-6" />} title="Заявка на рассмотрении" text="Мы проверяем анкету — обычно это занимает до 24 часов. Как только доступ откроют, библиотека появится здесь.">
        <Button asChild variant="outline"><Link to="/">На главную</Link></Button>
      </Card>
    );
  }

  if (data?.status === "blocked") {
    return (
      <Card icon={<ShieldX className="h-6 w-6" />} title="Доступ закрыт" text="Ваш аккаунт заблокирован в DJ-разделе. Если это ошибка — напишите нам.">
        <Button asChild variant="outline"><Link to="/contacts">Связаться</Link></Button>
      </Card>
    );
  }

  return <ApplyForm rejected={data?.status === "rejected"} />;
}

function ApplyForm({ rejected }: { rejected: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ nickname: "", city: "", contact: "", bio: "" });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const apply = useMutation({
    mutationFn: () => djApply({ data: form }),
    onSuccess: () => {
      toast.success("Заявка отправлена");
      void qc.invalidateQueries({ queryKey: DJ_ACCESS_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-lg">
      <div className="glass space-y-4 rounded-2xl p-6">
        <div>
          <h1 className="font-display text-2xl font-bold">
            {rejected ? "Отправить заявку повторно" : "Заявка в DJ-клуб"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Расскажите о себе — после одобрения откроется библиотека треков, софт и обсуждения.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dj-nick">DJ-имя *</Label>
          <Input id="dj-nick" value={form.nickname} onChange={(e) => set("nickname", e.target.value)} maxLength={60} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dj-city">Город</Label>
            <Input id="dj-city" value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dj-contact">Контакт (Telegram / Instagram)</Label>
            <Input id="dj-contact" value={form.contact} onChange={(e) => set("contact", e.target.value)} maxLength={200} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dj-bio">Опыт и площадки</Label>
          <Textarea id="dj-bio" rows={4} value={form.bio} onChange={(e) => set("bio", e.target.value)} maxLength={1000} />
        </div>
        <Button className="w-full" disabled={form.nickname.trim().length < 2 || apply.isPending} onClick={() => apply.mutate()}>
          {apply.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Отправить заявку
        </Button>
      </div>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[40vh] items-center justify-center">{children}</div>;
}

function Card({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="glass mx-auto max-w-lg space-y-4 rounded-2xl p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="text-sm text-muted-foreground">{text}</p>
      {children}
    </div>
  );
}
