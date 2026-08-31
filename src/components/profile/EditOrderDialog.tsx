import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { EditOrderForm } from "./types";

export function EditOrderDialog({
  open,
  form,
  onChange,
  onCancel,
  onSubmit,
  saving,
}: {
  open: boolean;
  form: EditOrderForm;
  onChange: (next: EditOrderForm) => void;
  onCancel: () => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  const patch = (p: Partial<EditOrderForm>) => onChange({ ...form, ...p });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Редактирование заявки</DialogTitle>
          <DialogDescription>Изменения будут отправлены менеджеру.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ed-name">Имя</Label>
            <Input id="ed-name" value={form.client_name} onChange={(e) => patch({ client_name: e.target.value })} />
          </div>
          <div className="grid-fields">
            <div className="grid gap-1.5">
              <Label htmlFor="ed-phone">Телефон</Label>
              <Input id="ed-phone" value={form.client_phone} onChange={(e) => patch({ client_phone: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ed-email">Email</Label>
              <Input id="ed-email" type="email" value={form.client_email} onChange={(e) => patch({ client_email: e.target.value })} />
            </div>
          </div>
          <div className="grid-fields">
            <div className="grid gap-1.5">
              <Label htmlFor="ed-company">Компания</Label>
              <Input id="ed-company" value={form.client_company} onChange={(e) => patch({ client_company: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ed-date">Дата мероприятия</Label>
              <Input id="ed-date" type="date" value={form.event_date} onChange={(e) => patch({ event_date: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ed-notes">Комментарий</Label>
            <Textarea id="ed-notes" rows={3} value={form.notes} onChange={(e) => patch({ notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Отмена</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? "Сохранение..." : "Сохранить"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
