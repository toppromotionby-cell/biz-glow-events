// Редактор блоков корпоративного документа: добавление, порядок, содержимое.
import { memo } from "react";
import {
  ArrowDown, ArrowUp, ChevronDown, Copy, GripVertical, Plus, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TextAreaField } from "@/components/admin/field-kit";
import {
  PW_BLOCK_LABELS, emptyBlock, pwId,
  type PwAlign, type PwBlock, type PwBlockType,
} from "@/lib/paperwork/model";
import { blockTotals, formatMoney, lineTotal } from "@/lib/paperwork/totals";
import type { SignatureAvailability } from "@/lib/documents/signature";

const ALIGNS: { key: PwAlign; label: string }[] = [
  { key: "left", label: "Слева" },
  { key: "center", label: "По центру" },
  { key: "right", label: "Справа" },
  { key: "justify", label: "По ширине" },
];

function AlignPicker({ value, onChange }: { value: PwAlign; onChange: (v: PwAlign) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden">
      {ALIGNS.map((a) => (
        <button
          key={a.key}
          type="button"
          onClick={() => onChange(a.key)}
          className={`px-2 py-1 text-xs transition-colors ${
            value === a.key ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

type BlockProps = {
  block: PwBlock;
  index: number;
  total: number;
  onChange: (patch: Partial<PwBlock>) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  /** Что доступно по загруженным картинкам компании. */
  sign: SignatureAvailability;
};

const BlockCard = memo(function BlockCard({
  block, index, total, onChange, onMove, onDuplicate, onRemove, sign,
}: BlockProps) {
  const cols = Math.max(block.header.length, ...block.rows.map((r) => r.length), 1);

  const setCell = (rowIdx: number, colIdx: number, v: string) => {
    const rows = block.rows.map((r, i) =>
      i === rowIdx ? Array.from({ length: cols }, (_, c) => (c === colIdx ? v : (r[c] ?? ""))) : r,
    );
    onChange({ rows });
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{PW_BLOCK_LABELS[block.type]}</span>
        <span className="text-xs text-muted-foreground">#{index + 1}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Выше">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Ниже">
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDuplicate} aria-label="Дублировать">
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onRemove} aria-label="Удалить">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        {(block.type === "heading" ||
          block.type === "paragraph" ||
          block.type === "note" ||
          block.type === "recipient") && (
          <>
            <TextAreaField
              value={block.text}
              onChange={(v) => onChange({ text: v })}
              placeholder="Текст блока. Переменные: {{Компания}}, {{Дата}}, {{Получатель}}"
              minRows={block.type === "heading" ? 1 : 3}
            />
            <div className="flex flex-wrap items-center gap-4">
              <AlignPicker value={block.align} onChange={(align) => onChange({ align })} />
              {block.type === "paragraph" && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={block.indent} onCheckedChange={(indent) => onChange({ indent })} />
                  Красная строка
                </label>
              )}
            </div>
          </>
        )}

        {block.type === "list" && (
          <>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={block.ordered} onCheckedChange={(ordered) => onChange({ ordered })} />
              Нумерованный список
            </label>
            <div className="space-y-2">
              {block.items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-2 w-5 text-xs text-muted-foreground">{block.ordered ? `${i + 1}.` : "•"}</span>
                  <TextAreaField
                    value={item}
                    minRows={1}
                    onChange={(v) => onChange({ items: block.items.map((x, xi) => (xi === i ? v : x)) })}
                    placeholder="Пункт списка"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onChange({ items: block.items.filter((_, xi) => xi !== i) })}
                    aria-label="Удалить пункт"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={() => onChange({ items: [...block.items, ""] })}>
              <Plus className="mr-1 h-4 w-4" /> Пункт
            </Button>
          </>
        )}

        {block.type === "table" && (
          <div className="space-y-2">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {Array.from({ length: cols }, (_, c) => (
                      <th key={c} className="border border-border p-1">
                        <Input
                          value={block.header[c] ?? ""}
                          onChange={(e) =>
                            onChange({
                              header: Array.from({ length: cols }, (_, i) =>
                                i === c ? e.target.value : (block.header[i] ?? ""),
                              ),
                            })
                          }
                          className="h-8 text-xs font-medium"
                          placeholder={`Колонка ${c + 1}`}
                        />
                      </th>
                    ))}
                    <th className="w-9" />
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, r) => (
                    <tr key={r}>
                      {Array.from({ length: cols }, (_, c) => (
                        <td key={c} className="border border-border p-1">
                          <Input
                            value={row[c] ?? ""}
                            onChange={(e) => setCell(r, c, e.target.value)}
                            className="h-8 text-xs"
                          />
                        </td>
                      ))}
                      <td className="p-1 align-middle">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onChange({ rows: block.rows.filter((_, i) => i !== r) })}
                          aria-label="Удалить строку"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onChange({ rows: [...block.rows, Array.from({ length: cols }, () => "")] })}
              >
                <Plus className="mr-1 h-4 w-4" /> Строка
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onChange({
                    header: [...Array.from({ length: cols }, (_, i) => block.header[i] ?? ""), ""],
                    rows: block.rows.map((r) => [...Array.from({ length: cols }, (_, i) => r[i] ?? ""), ""]),
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Колонка
              </Button>
              {cols > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    onChange({
                      header: block.header.slice(0, cols - 1),
                      rows: block.rows.map((r) => r.slice(0, cols - 1)),
                    })
                  }
                >
                  Убрать колонку
                </Button>
              )}
            </div>
          </div>
        )}

        {block.type === "signature" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Должность</Label>
              <Input value={block.signerTitle} onChange={(e) => onChange({ signerTitle: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ФИО</Label>
              <Input value={block.signerName} onChange={(e) => onChange({ signerName: e.target.value })} />
            </div>
            {sign.hasSignature && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={block.withSignature} onCheckedChange={(v) => onChange({ withSignature: v })} />
                Накладывать подпись
              </label>
            )}
            {sign.hasStamp && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={block.withStamp} onCheckedChange={(v) => onChange({ withStamp: v })} />
                Ставить печать
              </label>
            )}
            {!sign.hasSignature && !sign.hasStamp && (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Загрузите подпись или печать в карточке компании — тогда их можно будет накладывать на документ.
              </p>
            )}
          </div>
        )}


        {block.type === "spacer" && (
          <div className="flex items-center gap-2">
            <Label className="text-xs">Высота, пт</Label>
            <Input
              type="number"
              min={4}
              max={200}
              value={block.size}
              onChange={(e) => onChange({ size: Number(e.target.value) || 12 })}
              className="h-8 w-24"
            />
          </div>
        )}

        {block.type === "lineitems" && (
          <div className="space-y-2">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="p-1 text-left">Наименование</th>
                    <th className="w-20 p-1">Кол-во</th>
                    <th className="w-20 p-1">Ед.</th>
                    <th className="w-28 p-1">Цена</th>
                    <th className="w-28 p-1">Сумма</th>
                    <th className="w-9" />
                  </tr>
                </thead>
                <tbody>
                  {block.lines.map((l, i) => {
                    const setLine = (p: Partial<typeof l>) =>
                      onChange({ lines: block.lines.map((x, xi) => (xi === i ? { ...x, ...p } : x)) });
                    return (
                      <tr key={i}>
                        <td className="p-1">
                          <Input value={l.name} onChange={(e) => setLine({ name: e.target.value })} className="h-8 text-xs" />
                        </td>
                        <td className="p-1">
                          <Input
                            type="number"
                            value={l.qty}
                            onChange={(e) => setLine({ qty: Number(e.target.value) || 0 })}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <Input value={l.unit} onChange={(e) => setLine({ unit: e.target.value })} className="h-8 text-xs" />
                        </td>
                        <td className="p-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={l.price}
                            onChange={(e) => setLine({ price: Number(e.target.value) || 0 })}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-1 text-right text-xs tabular-nums">{formatMoney(lineTotal(l))}</td>
                        <td className="p-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => onChange({ lines: block.lines.filter((_, xi) => xi !== i) })}
                            aria-label="Удалить позицию"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onChange({ lines: [...block.lines, { name: "", qty: 1, unit: "шт.", price: 0 }] })
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Позиция
              </Button>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Валюта</Label>
                <Input
                  value={block.currency}
                  onChange={(e) => onChange({ currency: e.target.value })}
                  className="h-8 w-24"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">НДС, %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={block.vatPct}
                  onChange={(e) => onChange({ vatPct: Number(e.target.value) || 0 })}
                  className="h-8 w-20"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={block.totalWords} onCheckedChange={(v) => onChange({ totalWords: v })} />
                Сумма прописью
              </label>
              <span className="ml-auto text-sm font-medium tabular-nums">
                Итого: {formatMoney(blockTotals(block).gross)} {block.currency}
              </span>
            </div>
          </div>
        )}

        {block.type === "parties" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Заголовок слева</Label>
              <Input value={block.leftTitle} onChange={(e) => onChange({ leftTitle: e.target.value })} />
              <TextAreaField
                value={block.leftText}
                minRows={4}
                onChange={(v) => onChange({ leftText: v })}
                placeholder="Реквизиты исполнителя"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Заголовок справа</Label>
              <Input value={block.rightTitle} onChange={(e) => onChange({ rightTitle: e.target.value })} />
              <TextAreaField
                value={block.rightText}
                minRows={4}
                onChange={(v) => onChange({ rightText: v })}
                placeholder="Реквизиты заказчика"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

const BLOCK_GROUPS: { label: string; types: PwBlockType[] }[] = [
  { label: "Текст", types: ["heading", "paragraph", "list", "note"] },
  { label: "Таблицы", types: ["table", "lineitems"] },
  { label: "Реквизиты", types: ["recipient", "parties", "signature", "spacer", "pagebreak"] },
];

export function PwBlockList({
  blocks,
  onChange,
  suggested = [],
  sign = { hasSignature: false, hasStamp: false },
}: {
  blocks: PwBlock[];
  onChange: (next: PwBlock[]) => void;
  /** Доступность подписи и печати — считается по картинкам карточки компании. */
  sign?: SignatureAvailability;
  /** Блоки, релевантные текущему виду документа — показываем их кнопками. */
  suggested?: PwBlockType[];
}) {
  const patch = (i: number, p: Partial<PwBlock>) =>
    onChange(blocks.map((b, bi) => (bi === i ? { ...b, ...p } : b)));

  const add = (t: PwBlockType) => onChange([...blocks, emptyBlock(t)]);
  const quick: PwBlockType[] = (suggested.length ? suggested : (["heading", "paragraph", "list"] as PwBlockType[])).filter(
    (t, i, arr) => arr.indexOf(t) === i,
  );

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <BlockCard
          key={b.id}
          block={b}
          index={i}
          total={blocks.length}
          onChange={(p) => patch(i, p)}
          onMove={(dir) => move(i, dir)}
          onDuplicate={() => {
            const next = [...blocks];
            next.splice(i + 1, 0, { ...b, id: pwId() });
            onChange(next);
          }}
          onRemove={() => onChange(blocks.filter((_, bi) => bi !== i))}
          sign={sign}
        />
      ))}

      {!blocks.length && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Документ пуст — добавьте первый блок.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3">
        {quick.map((t) => (
          <Button key={t} size="sm" variant="outline" onClick={() => add(t)}>
            <Plus className="mr-1 h-4 w-4" />
            {PW_BLOCK_LABELS[t]}
          </Button>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost">
              <Plus className="mr-1 h-4 w-4" /> Ещё блок
              <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {BLOCK_GROUPS.map((g, gi) => (
              <div key={g.label}>
                {gi > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-xs text-muted-foreground">{g.label}</DropdownMenuLabel>
                {g.types.map((t) => (
                  <DropdownMenuItem key={t} onSelect={() => add(t)}>
                    {PW_BLOCK_LABELS[t]}
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
