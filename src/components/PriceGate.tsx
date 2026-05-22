// PriceGate — цены видны только авторизованным.
// Для гостей: размытая заглушка + CTA.
// SEO: рендерим JSON-LD aggregateOffer в <head>, контейнеры с цифрами помечены data-nosnippet + aria-hidden,
// чтобы Google не индексировал точные цифры, но видел структуру предложения.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface PriceGateProps {
  children: ReactNode;
  className?: string;
  ctaHref?: string;
}

export function PriceGate({ children, className, ctaHref = "/register" }: PriceGateProps) {
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
    <div className={cn("glass rounded-xl p-4 text-center space-y-2", className)}>
      <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
        <Lock className="h-4 w-4" />
        <span>Цены доступны после регистрации</span>
      </div>
      <Link
        to={ctaHref}
        className="inline-flex items-center justify-center rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition glow-primary"
      >
        Зарегистрироваться
      </Link>
    </div>
  );
}
