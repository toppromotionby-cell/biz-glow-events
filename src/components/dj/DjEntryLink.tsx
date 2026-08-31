// Постоянная точка входа в DJ-клуб: в шапке и в личном кабинете.
// Одобренного участника ведём сразу в библиотеку, остальных — на витрину с анкетой.
import { Link } from "@tanstack/react-router";
import { Disc3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDjAccess } from "@/components/dj/MemberGate";
import { DJ_DEFAULT_RETURN } from "@/lib/dj/return-to";
import { DJ_MEMBER_STATUS_LABEL } from "@/lib/dj/types";

export type DjEntry = { href: string; label: string; status: string | null; isMember: boolean };

export function djEntryFor(access: { isMember?: boolean; status?: string | null } | undefined): DjEntry | null {
  if (!access) return null;
  const status = access.status ?? null;
  if (access.isMember) return { href: DJ_DEFAULT_RETURN, label: "DJ-клуб", status, isMember: true };
  if (status === "blocked") return null;
  return { href: "/dj", label: status === "pending" ? "DJ-клуб · заявка" : "DJ-клуб", status, isMember: false };
}

/** Компактная ссылка для шапки. */
export function DjEntryLink({ variant = "ghost", full = false, onNavigate }: {
  variant?: "ghost" | "outline";
  full?: boolean;
  onNavigate?: () => void;
}) {
  const { data, isAuthenticated } = useDjAccess();
  const entry = isAuthenticated ? djEntryFor(data) : null;
  if (!entry) return null;
  return (
    <Link to={entry.href} onClick={onNavigate}>
      <Button variant={variant} size={full ? "default" : "sm"} className={full ? "w-full" : undefined}>
        <Disc3 className={full ? "mr-2 h-4 w-4" : "mr-1 h-4 w-4"} />
        {entry.label}
      </Button>
    </Link>
  );
}

/** Карточка статуса DJ-клуба в личном кабинете. */
export function DjProfileCard() {
  const { data, isAuthenticated } = useDjAccess();
  if (!isAuthenticated || !data) return null;
  const entry = djEntryFor(data);
  const status = data.status ?? null;

  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-semibold">
            <Disc3 className="h-4 w-4" /> DJ-клуб
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.isMember
              ? "Доступ открыт: библиотека треков, софт и загрузки."
              : status === "pending"
                ? "Заявка на модерации — доступ откроем в течение суток."
                : status === "blocked"
                  ? "Доступ к разделу закрыт."
                  : "Подайте заявку, чтобы получить доступ к библиотеке треков и софту."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <Badge variant={data.isMember ? "default" : "outline"}>
              {DJ_MEMBER_STATUS_LABEL[status as keyof typeof DJ_MEMBER_STATUS_LABEL] ?? status}
            </Badge>
          )}
          {entry && (
            <Link to={entry.href}>
              <Button size="sm" variant={data.isMember ? "default" : "outline"}>
                {data.isMember ? "Открыть библиотеку" : "Перейти в раздел"}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
