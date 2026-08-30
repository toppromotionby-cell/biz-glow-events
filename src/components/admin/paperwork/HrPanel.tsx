// Панель кадровых документов: период, реестр сотрудников, заполнение и пересчёт таблиц.
// Показывается только для видов «Зарплатная ведомость», «Штатное расписание», «Табель».
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calculator, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { listHrEmployees } from "@/lib/hr.functions";
import type { PwBlock, PwDocType } from "@/lib/paperwork/model";
import {
  MONTHS_RU,
  currentPeriod,
  normDays,
  normHours,
  periodLabel,
  type HrPeriod,
} from "@/lib/paperwork/hr/model";
import {
  buildPayrollTable,
  buildStaffingTable,
  buildTimesheetTable,
  findHrTable,
  recalcHrBlocks,
  replaceHrTable,
  staffingFund,
  timesheetSummary,
  type HrTableKind,
} from "@/lib/paperwork/hr/tables";

const KIND_BY_TYPE: Partial<Record<PwDocType, HrTableKind>> = {
  payroll: "payroll",
  staffing: "staffing",
  timesheet: "timesheet",
};

export function isHrDocType(docType: PwDocType): boolean {
  return KIND_BY_TYPE[docType] != null;
}

type Props = {
  docType: PwDocType;
  companyId: string | null;
  blocks: PwBlock[];
  onChange: (blocks: PwBlock[]) => void;
  period: HrPeriod;
  onPeriodChange: (p: HrPeriod) => void;
};

export function HrPanel({ docType, companyId, blocks, onChange, period, onPeriodChange }: Props) {
  const kind = KIND_BY_TYPE[docType];
  const fetchEmployees = useServerFn(listHrEmployees);
  const [advance, setAdvance] = useState(0);

  const employees = useQuery({
    queryKey: ["hr-employees", companyId],
    queryFn: () => fetchEmployees({ data: { companyId } }),
    enabled: Boolean(kind),
  });

  const staff = employees.data ?? [];
  const fund = useMemo(() => {
    const idx = findHrTable(blocks, "staffing");
    return idx >= 0 ? staffingFund(blocks[idx]) : null;
  }, [blocks]);

  if (!kind) return null;

  const fill = () => {
    if (!staff.length) {
      toast.error("Реестр сотрудников пуст — добавьте сотрудников в информационной базе");
      return;
    }
    let table: PwBlock;
    if (kind === "staffing") table = buildStaffingTable(staff);
    else if (kind === "timesheet") table = buildTimesheetTable(staff, period);
    else {
      const tsIdx = findHrTable(blocks, "timesheet");
      const source = tsIdx >= 0 ? timesheetSummary(blocks[tsIdx], period) : [];
      table = buildPayrollTable(staff, period, source, advance);
    }
    onChange(replaceHrTable(blocks, kind, table));
    toast.success(`Таблица заполнена: ${staff.length} сотр.`);
  };

  const recalc = () => {
    onChange(recalcHrBlocks(blocks, period));
    toast.success("Пересчитано");
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">Кадровые данные</p>
        <span className="text-xs text-muted-foreground">
          {periodLabel(period)} · норма {normDays(period)} дн. / {normHours(period)} ч.
          {staff.length ? ` · сотрудников: ${staff.length}` : ""}
          {fund ? ` · ФОТ: ${fund.fund} BYN` : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40 space-y-1">
          <Label className="text-xs">Месяц</Label>
          <Select
            value={String(period.month)}
            onValueChange={(v) => onPeriodChange({ ...period, month: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS_RU.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-28 space-y-1">
          <Label className="text-xs">Год</Label>
          <Input
            type="number"
            value={period.year}
            onChange={(e) => onPeriodChange({ ...period, year: Number(e.target.value) || period.year })}
          />
        </div>
        {kind === "payroll" && (
          <div className="w-32 space-y-1">
            <Label className="text-xs">Аванс, BYN</Label>
            <Input
              type="number"
              value={advance}
              onChange={(e) => setAdvance(Number(e.target.value) || 0)}
            />
          </div>
        )}
        <Button variant="outline" size="sm" onClick={fill} disabled={employees.isLoading}>
          <Users className="mr-1 h-4 w-4" /> Заполнить из реестра
        </Button>
        <Button variant="outline" size="sm" onClick={recalc}>
          <Calculator className="mr-1 h-4 w-4" /> Пересчитать
        </Button>
        <Button variant="ghost" size="sm" onClick={() => employees.refetch()}>
          <RefreshCw className="mr-1 h-4 w-4" /> Обновить реестр
        </Button>
      </div>

      {kind === "payroll" && findHrTable(blocks, "timesheet") < 0 && (
        <p className="text-xs text-muted-foreground">
          Дни и часы берутся из табеля за этот же период, если он есть в документе. Иначе
          подставляется норма месяца.
        </p>
      )}
    </div>
  );
}

export const defaultHrPeriod = currentPeriod;
