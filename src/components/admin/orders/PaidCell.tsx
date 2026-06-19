// Inline-редактирование суммы «Оплачено» в строке заказа.
import { useEffect, useState } from "react";
import { fmtMoney } from "@/lib/formatters";

interface PaidCellProps {
  value: number;
  total: number;
  disabled?: boolean;
  onSave: (v: number) => void;
}

export function PaidCell({ value, total, disabled, onSave }: PaidCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = () => {
    const n = Number(draft.replace(",", "."));
    setEditing(false);
    if (Number.isFinite(n) && n >= 0 && n !== value) onSave(n);
    else setDraft(String(value));
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min={0}
        step="0.01"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
        }}
        className="w-28 text-right px-2 py-1 rounded border border-primary/40 bg-input outline-none text-sm"
      />
    );
  }
  const full = value >= total && total > 0;
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Клик — изменить оплату"
      className={`px-2 py-0.5 rounded hover:bg-muted/40 cursor-text ${full ? "text-emerald-300" : "text-emerald-300/80"}`}
    >
      {fmtMoney(value)}
    </button>
  );
}
