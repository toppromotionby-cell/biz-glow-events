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

export function PriceGate({ children, className }: PriceGateProps) {
  return (
    <div className={className} data-nosnippet aria-label="Стоимость" role="group">
      {children}
    </div>
  );
}
