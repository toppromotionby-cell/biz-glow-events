import { Link, useRouter } from "@tanstack/react-router";
import { Home, RefreshCw } from "lucide-react";

/**
 * Единые экраны 404/500 для всего приложения.
 * Используются в root route, router defaults и (опционально) leaf routes.
 */

export function NotFoundView({ title, hint }: { title?: string; hint?: string } = {}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background bg-radial-glow px-4">
      <div className="max-w-md text-center">
        <h1 className="text-8xl font-display font-bold gradient-text">404</h1>
        <h2 className="mt-4 text-xl font-semibold">{title ?? "Страница не найдена"}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {hint ?? "Возможно, страница перемещена или удалена."}
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary"
        >
          <Home className="h-4 w-4" />
          На главную
        </Link>
      </div>
    </div>
  );
}

export function ErrorView({
  error,
  reset,
  title,
}: {
  error: Error;
  reset?: () => void;
  title?: string;
}) {
  if (typeof console !== "undefined") console.error(error);
  const router = useRouter();
  const isDev = import.meta.env.DEV;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background bg-radial-glow px-4">
      <div className="max-w-lg w-full text-center">
        <div className="text-7xl font-display font-bold gradient-text">500</div>
        <h1 className="mt-3 text-xl font-semibold">{title ?? "Что-то пошло не так"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Мы уже знаем о проблеме. Попробуйте ещё раз или вернитесь на главную.
        </p>

        {isDev && error?.message && (
          <pre className="mt-4 max-h-48 overflow-auto rounded-md border border-border/60 bg-card/60 p-3 text-left text-xs text-muted-foreground">
            {error.name}: {error.message}
            {error.stack ? `\n\n${error.stack}` : ""}
          </pre>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset?.();
            }}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground glow-primary"
          >
            <RefreshCw className="h-4 w-4" />
            Попробовать снова
          </button>
          <Link
            to="/"
            onClick={() => reset?.()}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm"
          >
            <Home className="h-4 w-4" />
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
