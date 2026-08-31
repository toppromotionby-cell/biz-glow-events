// Карточка финансов: сумма, оплачено, долг, прогресс и быстрый ввод оплаты.
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { fmtMoney } from "@/lib/formatters";

export interface OrderFinanceCardProps {
  total: number;
  paid: number;
  onAddPayment: (amount: number) => void;
  onSetPaid: (paid: number) => void;
  busy?: boolean;
}

export function OrderFinanceCard({ total, paid, onAddPayment, onSetPaid, busy }: OrderFinanceCardProps) {
  const debt = Math.max(total - paid, 0);
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const [amount, setAmount] = useState("");

  const submit = () => {
    const n = Number(amount.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return;
    onAddPayment(n);
    setAmount("");
  };

  return (
    <div className="space-y-3">
      <div className="grid-stats text-sm">
        <Stat label="Сумма" value={fmtMoney(total)} />
        <Stat label="Оплачено" value={fmtMoney(paid)} tone="success" />
        <Stat label="Долг" value={fmtMoney(debt)} tone={debt > 0 ? "warning" : "muted"} />
      </div>
      <div className="space-y-1.5">
        <Progress value={pct} className="h-1.5" />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{pct}% оплачено</span>
          {paid > 0 && (
            <button
              type="button"
              onClick={() => onSetPaid(0)}
              className="hover:text-foreground transition-colors"
              disabled={busy}
            >
              Сбросить
            </button>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          type="text"
          inputMode="decimal"
          placeholder="Сумма, BYN"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          className="h-9 text-sm"
          disabled={busy}
        />
        <Button size="sm" onClick={submit} disabled={busy || !amount}>
          <Plus className="h-4 w-4 mr-1" />Внести
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "muted" }) {
  const cls = tone === "success" ? "text-emerald-300"
    : tone === "warning" ? "text-amber-300"
    : tone === "muted" ? "text-muted-foreground"
    : "text-foreground";
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
