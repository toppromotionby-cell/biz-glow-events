// PriceGate — детальная цена видна только авторизованным,
// но публично показываем минимальную цену "от X BYN" — это критично
// для конверсии: пользователь не уходит с сайта в поисках цен.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const fmt = new Intl.NumberFormat("ru-BY", {
  style: "currency",
  currency: "BYN",
  maximumFractionDigits: 0,
});

interface PriceGateProps {
  children: ReactNode;
  className?: string;
  ctaHref?: string;
  /** Минимальная цена для публичного превью. Если задана — гости видят "от X BYN". */
  fromPrice?: number | null;
}

export function PriceGate({ children, className, ctaHref = "/register", fromPrice }: PriceGateProps) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className={cn("h-10 w-32 rounded-md bg-muted/40 animate-pulse", className)} />;
  }

  if (isAuthenticated) {
    return (
      <div className={className} data-nosnippet aria-label="Стоимость" role="group">
        {children}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {fromPrice && fromPrice > 0 ? (
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Стоимость</div>
          <div className="text-2xl font-display font-bold">
            от <span className="gradient-text">{fmt.format(fromPrice)}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Точная стоимость и пакеты — после регистрации
          </div>
        </div>
      ) : (
        <div className="text-2xl font-display font-bold text-muted-foreground">По запросу</div>
      )}
      <Link
        to={ctaHref}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/40 px-4 py-2 text-sm font-medium hover:bg-primary/10 transition w-full"
      >
        <Lock className="h-3.5 w-3.5" />
        Войти, чтобы увидеть детали
      </Link>
    </div>
  );
}
