// Единая кнопка «Открыть в новом окне» / «Открыть на сайте» для админки.
import type { ComponentProps, ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { openInNewTab } from "@/lib/open-external";

type Props = {
  /** Готовая ссылка. Если null/пусто — кнопка неактивна. */
  href?: string | null;
  /** Асинхронное получение ссылки по клику (например, подписанный URL). */
  onResolve?: () => string | null | Promise<string | null>;
  label?: string;
  /** Подсказка, почему кнопка неактивна. */
  reason?: string | null;
  disabled?: boolean;
  size?: ComponentProps<typeof Button>["size"];
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
  /** Имя окна: одинаковое имя переиспользует ранее открытую вкладку. */
  target?: string;
  icon?: ReactNode;
};

export function OpenInNewTabButton({
  href,
  onResolve,
  label = "В новом окне",
  reason,
  disabled,
  size = "sm",
  variant = "outline",
  className,
  target,
  icon,
}: Props) {
  const inactive = disabled || (!onResolve && !(href ?? "").trim());

  const handleClick = async () => {
    const url = onResolve ? await onResolve() : href;
    openInNewTab(url, target ? { target } : {});
  };

  const button = (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      disabled={inactive}
      onClick={() => void handleClick()}
    >
      {icon ?? <ExternalLink className="mr-1.5 h-3.5 w-3.5" />}
      {label}
    </Button>
  );

  if (!inactive || !reason) return button;

  return (
    <Tooltip>
      {/* span нужен: у disabled-кнопки не срабатывают события наведения */}
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
