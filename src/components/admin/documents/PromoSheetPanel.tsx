// Панель синхронизации промо-КП с Google Таблицей — тонкая обёртка над общим SheetSyncPanel.
import { useServerFn } from "@tanstack/react-start";
import {
  applyPromoSheetDiff,
  ensurePromoSheet,
  getPromoSheetDiff,
  pushPromoToSheet,
  type PromoSheetDiffRow,
} from "@/lib/promo-sheets.functions";
import { SheetSyncPanel, sheetMoney as money } from "./SheetSyncPanel";

const KIND_LABEL: Record<PromoSheetDiffRow["kind"], string> = {
  added: "Новая позиция",
  changed: "Изменено",
  removed: "Удалена в источнике",
};

function RowSummary({ row }: { row: PromoSheetDiffRow }) {
  const it = row.after ?? row.before;
  if (!it) return null;
  const lineTotal = (r: NonNullable<PromoSheetDiffRow["after"]>) => r.qty * r.multiplier * r.price;
  return (
    <div className="min-w-0">
      <div className="truncate font-medium">{it.title || "Без названия"}</div>
      <div className="text-xs text-muted-foreground truncate">
        {it.section || "Без раздела"} · {it.qty} {it.unit} × {it.multiplier} × {money(it.price)}
        {!it.included && " · не в итог"}
        {it.exclude_from_commission && " · без комиссии"}
        {it.is_info && " · справочно"}
      </div>
      {row.kind === "changed" && row.before && row.after && (
        <div className="mt-1 text-xs text-amber-600">
          {row.fields.join(", ")}: {money(lineTotal(row.before))} → {money(lineTotal(row.after))}
        </div>
      )}
    </div>
  );
}

export function PromoSheetPanel({ quoteId }: { quoteId: string }) {
  const ensure = useServerFn(ensurePromoSheet);
  const push = useServerFn(pushPromoToSheet);
  const loadDiff = useServerFn(getPromoSheetDiff);
  const apply = useServerFn(applyPromoSheetDiff);

  return (
    <SheetSyncPanel<PromoSheetDiffRow>
      queryKey={["promo-sheet", quoteId]}
      loadDiff={() => loadDiff({ data: { id: quoteId } })}
      ensureSheet={() => ensure({ data: { id: quoteId } })}
      pushSheet={() => push({ data: { id: quoteId } })}
      applyRows={(rowIds) => apply({ data: { id: quoteId, rowIds } })}
      invalidateKeys={[adminKeys.promoQuote(quoteId), adminKeys.documents]}
      kindLabel={KIND_LABEL}
      renderRow={(row) => <RowSummary row={row} />}
      createLabel="Создать таблицу"
      createdToast="Таблица оформлена как КП"
      compareDescription="Отметьте строки, которые нужно применить к составу промо-КП."
      hint={
        <>
          Таблица повторяет превью: шапка, разделы, итоги и живые формулы («Всего» = кол-во × кол-во 2 × цена).
          Служебные поля (ID, себестоимость, флаги) спрятаны в скрытых колонках — правьте видимые ячейки, а затем
          заберите изменения обратно.
        </>
      }
    />
  );
}
