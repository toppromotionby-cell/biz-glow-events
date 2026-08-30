// Мастер создания документа «Договор подряда + акт»: собираем данные подрядчика,
// сроки и суммы. Налоги (13% и ФСЗН 1%) и сумма к выплате считаются автоматически.
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WORKACT_PRESET_ID } from "@/lib/paperwork/workact-preset";
import { money, workActAmounts } from "@/lib/paperwork/workact-calc";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  onSubmit: (args: { presetId: string; title: string; values: Record<string, string> }) => void;
  /** Пустой документ без шаблона. */
  onBlank: () => void;
};

const today = () => new Date().toISOString().slice(0, 10);

/** «2026-07-23» → «23.07.2026». */
function ru(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso.trim();
}

type Form = {
  fio: string;
  passSeries: string;
  passNumber: string;
  passIssuer: string;
  passDate: string;
  personalNumber: string;
  address: string;
  contractNumber: string;
  contractDate: string;
  city: string;
  subject: string;
  from: string;
  to: string;
  price: string;
  actNumber: string;
  actDate: string;
  actPrice: string;
};

const EMPTY: Form = {
  fio: "",
  passSeries: "",
  passNumber: "",
  passIssuer: "",
  passDate: "",
  personalNumber: "",
  address: "",
  contractNumber: "",
  contractDate: today(),
  city: "г. Минск",
  subject: "координации проектов агентства ООО «ТОП ПРОМОУШН»",
  from: today(),
  to: today(),
  price: "",
  actNumber: "1",
  actDate: today(),
  actPrice: "",
};

const num = (s: string) => Number(s.replace(/\s/g, "").replace(",", ".")) || 0;

export function WorkActDialog({ open, onOpenChange, busy, onSubmit, onBlank }: Props) {
  const [f, setF] = useState<Form>(EMPTY);
  const set = (patch: Partial<Form>) => setF((prev) => ({ ...prev, ...patch }));

  const contractSum = useMemo(() => workActAmounts(num(f.price)), [f.price]);
  const actSum = useMemo(
    () => workActAmounts(num(f.actPrice || f.price)),
    [f.actPrice, f.price],
  );

  const submit = () => {
    const values: Record<string, string> = {
      "ФИО подрядчика": f.fio.trim(),
      "Серия паспорта": f.passSeries.trim(),
      "Номер паспорта": f.passNumber.trim(),
      "Кем выдан паспорт": f.passIssuer.trim(),
      "Дата выдачи паспорта": f.passDate ? `${ru(f.passDate)} г.` : "",
      "Идентификационный номер": f.personalNumber.trim(),
      "Адрес регистрации": f.address.trim(),
      "Номер договора": f.contractNumber.trim(),
      "Дата договора": ru(f.contractDate),
      "Номер документа": f.contractNumber.trim(),
      "Город": f.city.trim(),
      "Предмет работ": f.subject.trim(),
      "Начало работ": `${ru(f.from)} г.`,
      "Окончание работ": `${ru(f.to)} г.`,
      "Цена работы": `${money(contractSum.price)} BYN`,
      "Цена работы прописью": contractSum.priceWords,
      "Подоходный налог": `${money(contractSum.tax)} BYN`,
      "Подоходный налог прописью": contractSum.taxWords,
      "Взносы ФСЗН": `${money(contractSum.fszn)} BYN`,
      "Взносы ФСЗН прописью": contractSum.fsznWords,
      "Сумма к выплате": `${money(contractSum.payout)} BYN`,
      "Сумма к выплате прописью": contractSum.payoutWords,
      "Номер акта": f.actNumber.trim(),
      "Дата акта": ru(f.actDate),
      "Сумма акта": `${money(actSum.price)} BYN`,
      "Сумма акта прописью": actSum.priceWords,
      "Подоходный налог по акту": `${money(actSum.tax)} BYN`,
      "Подоходный налог по акту прописью": actSum.taxWords,
      "Взносы ФСЗН по акту": `${money(actSum.fszn)} BYN`,
      "Взносы ФСЗН по акту прописью": actSum.fsznWords,
      "Сумма к выплате по акту": `${money(actSum.payout)} BYN`,
      "Сумма к выплате по акту прописью": actSum.payoutWords,
    };
    const title = [
      "Договор подряда",
      f.contractNumber.trim() ? `№ ${f.contractNumber.trim()}` : "",
      f.fio.trim() ? `— ${f.fio.trim()}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    onSubmit({ presetId: WORKACT_PRESET_ID, title, values });
  };

  const field = (label: string, key: keyof Form, type = "text", placeholder = "") => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={f[key]}
        placeholder={placeholder}
        onChange={(e) => set({ [key]: e.target.value } as Partial<Form>)}
        className="h-9"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новый договор подряда с актом</DialogTitle>
          <DialogDescription>
            Заполните данные — остальной текст договора и акта подставится из шаблона.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-2">
            <p className="text-sm font-medium">Подрядчик</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {field("ФИО полностью", "fio", "text", "Иванова Мария Петровна")}
              {field("Идентификационный номер", "personalNumber", "text", "6070504А014РВ3")}
              {field("Серия паспорта", "passSeries", "text", "МР")}
              {field("Номер паспорта", "passNumber", "text", "4883664")}
              {field("Кем выдан", "passIssuer", "text", "Московское РУВД г. Минска")}
              {field("Дата выдачи", "passDate", "date")}
              <div className="sm:col-span-2">{field("Адрес регистрации", "address", "text", "Республика Беларусь, г. Минск, ул. …")}</div>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium">Договор и работы</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {field("Номер договора", "contractNumber", "text", "23/07/26")}
              {field("Дата договора", "contractDate", "date")}
              {field("Город", "city")}
              {field("Начало работ", "from", "date")}
              {field("Окончание работ", "to", "date")}
              <div className="sm:col-span-3">{field("Предмет работ (после слов «по …»)", "subject")}</div>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium">Суммы</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {field("Цена работы по договору, BYN", "price", "text", "930,23")}
              {field("Номер акта", "actNumber")}
              {field("Дата акта", "actDate", "date")}
              <div className="sm:col-span-3">
                {field("Цена по акту, BYN (если отличается)", "actPrice", "text", "как в договоре")}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <div className="grid gap-1 sm:grid-cols-2">
                <span className="text-muted-foreground">Подоходный налог 13%</span>
                <span className="sm:text-right">{money(contractSum.tax)} BYN</span>
                <span className="text-muted-foreground">Взносы ФСЗН 1%</span>
                <span className="sm:text-right">{money(contractSum.fszn)} BYN</span>
                <span className="font-medium">Сумма к выплате</span>
                <span className="font-medium sm:text-right">{money(contractSum.payout)} BYN</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                По акту к выплате: {money(actSum.payout)} BYN
              </p>
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" disabled={busy} onClick={onBlank}>
            Пустой документ без шаблона
          </Button>
          <Button onClick={submit} disabled={busy || !f.fio.trim()}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Создать документ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
