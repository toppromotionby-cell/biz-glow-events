import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Единый стиль для всех toast-уведомлений. Цвета — из дизайн-токенов
// (никаких хардкодов вроде bg-white). richColors даёт семантику для success/error/warning.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      visibleToasts={4}
      style={{ zIndex: 110 }}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card/95 group-[.toaster]:backdrop-blur group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border/60 group-[.toaster]:shadow-xl group-[.toaster]:rounded-lg",
          title: "text-sm font-medium",
          description: "group-[.toast]:text-muted-foreground text-xs",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-md",
          success: "group-[.toaster]:border-emerald-500/30",
          error: "group-[.toaster]:border-rose-500/40",
          warning: "group-[.toaster]:border-amber-500/40",
          info: "group-[.toaster]:border-sky-500/30",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
