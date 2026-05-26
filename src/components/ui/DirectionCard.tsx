// Универсальная плитка направления: иконка-блок + заголовок + описание + опциональный CTA-блок.
import { Link, type LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Если задан, вся карточка — ссылка. */
  to?: LinkProps["to"];
  /** Дополнительный контент под текстом (CTA, доп. ссылки). */
  footer?: ReactNode;
}

export function DirectionCard({ icon: Icon, title, description, to, footer }: Props) {
  const inner = (
    <>
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary mb-4 group-hover:glow-primary transition">
        <Icon className="h-6 w-6 text-primary-foreground" />
      </div>
      <h3 className="font-semibold mb-2 leading-snug text-balance">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground flex-1 text-pretty max-w-[34ch] md:max-w-none">{description}</p>
      {footer ? <div className="mt-5 w-full">{footer}</div> : null}
    </>
  );
  const className =
    "group glass rounded-2xl p-6 flex flex-col h-full items-center text-center md:items-start md:text-left hover:border-primary/50 transition";
  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}
