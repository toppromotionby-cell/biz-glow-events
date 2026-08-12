// Панель синхронизации КП с Google Таблицами — тонкая обёртка над общим SheetSyncPanel.
import { useServerFn } from "@tanstack/react-start";
import {
  applyQuoteSheetDiff,
  ensureQuoteSheet,
  getQuoteSheetDiff,
  pushQuoteToSheet,
  type SheetDiffRow,
} from "@/lib/quote-sheets.functions";
import { SheetSyncPanel, sheetMoney as money } from "./SheetSyncPanel";

const KIND_LABEL: Record<SheetDiffRow["kind"], string> = {
  added: "Новая позиция",
  changed: "Изменено",
  removed: "Удалена в таблице",
};

function RowSummary({ row }: { row: SheetDiffRow }) {
  const it = row.after ?? row.before;
  if (!it) return null;
  return (
    <div className="min-w-0">
      <div className="truncate font-medium">{it.title || "Без названия"}</div>
      <div className="text-xs text-muted-foreground truncate">
        {it.section || "Без раздела"} · {it.qty} {it.unit} × {money(it.price)}
      </div>
      {row.kind === "changed" && row.before && row.after && (
        <div className="mt-1 text-xs text-amber-600">
          {row.fields.join(", ")}: {money(row.before.price * row.before.qty)} → {money(row.after.price * row.after.qty)}
        </div>
      )}
    </div>
  );
}

export function QuoteSheetPanel({ quoteId }: { quoteId: string }) {
  const ensure = useServerFn(ensureQuoteSheet);
  const push = useServerFn(pushQuoteToSheet);
  const loadDiff = useServerFn(getQuoteSheetDiff);
  const apply = useServerFn(applyQuoteSheetDiff);

  return (
    <SheetSyncPanel<SheetDiffRow>
      queryKey={["quote-sheet", quoteId]}
      loadDiff={() => loadDiff({ data: { id: quoteId } })}
      ensureSheet={() => ensure({ data: { id: quoteId } })}
      pushSheet={() => push({ data: { id: quoteId } })}
      applyRows={(rowIds) => apply({ data: { id: quoteId, rowIds } })}
      invalidateKeys={[adminKeys.quote(quoteId), adminKeys.documents]}
      kindLabel={KIND_LABEL}
      renderRow={(row) => <RowSummary row={row} />}
      createLabel="Открыть в Google Таблицах"
      createdToast="Таблица готова"
      compareDescription="Отметьте строки, которые нужно применить к составу КП."
    />
  );
}
