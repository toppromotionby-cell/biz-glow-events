import type { FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export type Requisites = {
  company_legal_name: string | null;
  company_unp: string | null;
  company_address: string | null;
  company_bank: string | null;
  contact_person_name: string | null;
  contact_person_position: string | null;
  acting_basis: string | null;
};

export const EMPTY_REQUISITES: Requisites = {
  company_legal_name: null,
  company_unp: null,
  company_address: null,
  company_bank: null,
  contact_person_name: null,
  contact_person_position: null,
  acting_basis: null,
};

function ReqField({
  label,
  name,
  placeholder,
  maxLength,
  textarea,
}: {
  label: string;
  name: string;
  placeholder?: string;
  maxLength?: number;
  textarea?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground">{label}</span>
      {textarea ? (
        <textarea
          name={name}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={2}
          className="mt-1 w-full rounded-md bg-background/50 border border-border px-3 py-2 outline-none focus:border-primary"
        />
      ) : (
        <input
          name={name}
          type="text"
          placeholder={placeholder}
          maxLength={maxLength}
          className="mt-1 w-full rounded-md bg-background/50 border border-border px-3 py-2 outline-none focus:border-primary"
        />
      )}
    </label>
  );
}

export function RequisitesDialog({
  open,
  onOpenChange,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading: boolean;
  onConfirm: (req: Requisites) => void;
}) {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => {
      const v = String(fd.get(k) ?? "").trim();
      return v ? v : null;
    };
    onConfirm({
      company_legal_name: get("company_legal_name"),
      company_unp: get("company_unp"),
      company_address: get("company_address"),
      company_bank: get("company_bank"),
      contact_person_name: get("contact_person_name"),
      contact_person_position: get("contact_person_position"),
      acting_basis: get("acting_basis"),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Реквизиты для подготовки документов</DialogTitle>
          <DialogDescription>
            Заполните реквизиты компании и данные ответственного лица. Это нужно, чтобы мы могли подготовить договор и счёт. Поля можно пропустить, если оплата от физлица — менеджер уточнит детали при звонке.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Компания</h3>
            <ReqField label="Юридическое название" name="company_legal_name" placeholder="ООО «Ромашка»" maxLength={240} />
            <div className="grid sm:grid-cols-2 gap-3">
              <ReqField label="УНП / ИНН" name="company_unp" placeholder="123456789" maxLength={40} />
              <ReqField label="Юридический адрес" name="company_address" placeholder="г. Минск, ул. ..." maxLength={300} />
            </div>
            <ReqField label="Банковские реквизиты" name="company_bank" placeholder="Р/с, БИК, наименование банка" maxLength={300} textarea />
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ответственное лицо</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <ReqField label="ФИО" name="contact_person_name" placeholder="Иванов Иван Иванович" maxLength={160} />
              <ReqField label="Должность" name="contact_person_position" placeholder="Директор" maxLength={160} />
            </div>
            <ReqField label="Действует на основании" name="acting_basis" placeholder="Устава / доверенности № … от …" maxLength={200} />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary disabled:opacity-60"
            >
              {loading ? "Отправляем..." : "Подтвердить и отправить"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
