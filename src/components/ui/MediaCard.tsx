// Карточка с обложкой 16/10 и контентом снизу. Используется в кейсах, блоге и featured-каталоге.
import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface Props {
  cover?: string | null;
  alt?: string;
  /** Приоритетная загрузка (для первой карточки выше первого экрана). */
  eager?: boolean;
  /** Маршрут TanStack — если задан, вся карточка ссылка. */
  to?: LinkProps["to"];
  params?: LinkProps["params"];
  /** onClick — альтернатива to (рендерит button). */
  onClick?: () => void;
  ariaLabel?: string;
  /** Размер скруглений; по умолчанию xl. */
  rounded?: "xl" | "2xl";
  /** Контент карточки под обложкой. */
  children: ReactNode;
}

export function MediaCard({
  cover,
  alt = "",
  eager,
  to,
  params,
  onClick,
  ariaLabel,
  rounded = "xl",
  children,
}: Props) {
  const className = `group glass rounded-${rounded} overflow-hidden hover:border-primary/50 transition flex flex-col h-full text-left w-full`;
  const body = (
    <>
      <div className="aspect-[16/10] bg-gradient-primary/10 overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt={alt}
            width={640}
            height={400}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            decoding="async"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : null}
      </div>
      <div className="p-4 flex-1 flex flex-col">{children}</div>
    </>
  );
  if (to) {
    return (
      <Link to={to} params={params} className={className} aria-label={ariaLabel}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} aria-label={ariaLabel}>
        {body}
      </button>
    );
  }
  return <article className={className}>{body}</article>;
}
