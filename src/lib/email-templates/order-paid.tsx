import * as React from 'react';
import type { TemplateEntry } from './registry';
import {
  EmailShell, EmailH1, EmailText, EmailSection, EmailInfoCard, EmailField,
} from './_shared';

interface Props {
  clientName?: string;
  orderId?: string;
  total?: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 0 }).format(n);

export function OrderPaidEmail({ clientName = 'клиент', orderId = '—', total = 0 }: Props) {
  return (
    <EmailShell preview={`Оплата по заказу #${orderId} получена`} variant="success">
      <EmailSection top={20}>
        <EmailH1>Оплата получена</EmailH1>
        <EmailText>Спасибо, {clientName}!</EmailText>
        <EmailText>
          Мы получили оплату по заказу <strong>#{orderId}</strong>
          {total > 0 ? <> на сумму <strong>{fmt(total)}</strong></> : null}.
        </EmailText>
      </EmailSection>

      <EmailInfoCard variant="success">
        <EmailField label="Заказ" value={<strong>#{orderId}</strong>} />
        {total > 0 && <EmailField label="Сумма оплаты" value={<strong>{fmt(total)}</strong>} />}
        <EmailField label="Статус" value={<strong style={{ color: '#22c55e' }}>Оплачен</strong>} />
      </EmailInfoCard>

      <EmailSection>
        <EmailText>Мы свяжемся с вами по деталям мероприятия в ближайшее время.</EmailText>
      </EmailSection>
    </EmailShell>
  );
}

export const template = {
  component: OrderPaidEmail,
  subject: (d: Record<string, unknown>) => `Оплата по заказу #${(d.orderId as string) ?? ''} получена`,
  displayName: 'Клиенту: оплата получена',
  previewData: { clientName: 'Иван', orderId: 'ord_abc123', total: 1500 },
} satisfies TemplateEntry;
