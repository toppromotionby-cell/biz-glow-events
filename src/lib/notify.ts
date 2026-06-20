// Единый стиль уведомлений для всего приложения.
// Используем sonner под капотом, но скрываем за тонкими хелперами,
// чтобы UI-сообщения были предсказуемыми по тону, длительности и иконке.
import { toast, type ExternalToast } from "sonner";
import { CheckCircle2, AlertTriangle, Info, XCircle, Loader2, Save, Mail } from "lucide-react";
import { createElement, type ReactNode } from "react";

type Opts = ExternalToast & { description?: ReactNode };

// Длительности подобраны так, чтобы успех читался быстро,
// предупреждение задерживалось, а ошибка оставалась до клика по близкой к ней области.
const DURATION = {
  success: 2600,
  info: 3000,
  warning: 5000,
  error: 6500,
  autosave: 1600,
} as const;

const icon = (Component: typeof CheckCircle2, className: string) =>
  createElement(Component, { className: `h-4 w-4 ${className}`, "aria-hidden": true });

export const notify = {
  success(message: string, opts: Opts = {}) {
    return toast.success(message, {
      duration: DURATION.success,
      icon: icon(CheckCircle2, "text-emerald-400"),
      ...opts,
    });
  },
  error(message: string, opts: Opts = {}) {
    return toast.error(message, {
      duration: DURATION.error,
      icon: icon(XCircle, "text-rose-400"),
      ...opts,
    });
  },
  warning(message: string, opts: Opts = {}) {
    return toast.warning(message, {
      duration: DURATION.warning,
      icon: icon(AlertTriangle, "text-amber-400"),
      ...opts,
    });
  },
  info(message: string, opts: Opts = {}) {
    return toast(message, {
      duration: DURATION.info,
      icon: icon(Info, "text-sky-400"),
      ...opts,
    });
  },
  // Письма / транзакционные подтверждения — отдельный визуальный акцент.
  email(message: string, opts: Opts = {}) {
    return toast.success(message, {
      duration: DURATION.success,
      icon: icon(Mail, "text-primary"),
      ...opts,
    });
  },
  // Короткое подтверждение автосейва — без description, минимальной длительности.
  autosaved(message = "Сохранено", opts: Opts = {}) {
    return toast.success(message, {
      duration: DURATION.autosave,
      icon: icon(Save, "text-emerald-400"),
      ...opts,
    });
  },
  // Промис: применяется к долгим операциям. Сообщения единым форматом.
  promise<T>(
    promise: Promise<T>,
    msgs: { loading: string; success: string | ((v: T) => string); error: string | ((e: unknown) => string) },
  ) {
    return toast.promise(promise, {
      loading: msgs.loading,
      success: msgs.success,
      error: msgs.error,
      icon: icon(Loader2, "text-primary animate-spin"),
    });
  },
  dismiss: toast.dismiss,
};

export type Notify = typeof notify;
