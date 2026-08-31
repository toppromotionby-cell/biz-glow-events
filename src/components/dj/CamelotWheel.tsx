// Колесо Camelot: сетка 12×2 с подсветкой совместимых тональностей.
import { cn } from "@/lib/utils";
import { compatibleKeys } from "@/lib/dj/types";

const NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1);

export function CamelotWheel({
  value,
  onChange,
}: {
  value?: string;
  onChange: (key: string | undefined) => void;
}) {
  const friends = new Set(compatibleKeys(value));

  return (
    <div className="space-y-2">
      {(["A", "B"] as const).map((letter) => (
        <div key={letter} className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
            {letter === "A" ? "Minor A" : "Major B"}
          </span>
          <div className="grid flex-1 grid-cols-12 gap-1">
            {NUMBERS.map((n) => {
              const key = `${n}${letter}`;
              const active = value === key;
              const friendly = friends.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange(active ? undefined : key)}
                  aria-pressed={active}
                  title={friendly && !active ? `Гармонично сводится с ${value}` : key}
                  className={cn(
                    "rounded-md py-1 text-[0.65rem] font-semibold tabular-nums transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : friendly
                        ? "bg-accent/25 text-accent-foreground ring-1 ring-accent/50"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {value && (
        <p className="text-[0.7rem] text-muted-foreground">
          Выбрано <span className="font-semibold text-foreground">{value}</span>, совместимо с{" "}
          {compatibleKeys(value).join(", ")}
        </p>
      )}
    </div>
  );
}
