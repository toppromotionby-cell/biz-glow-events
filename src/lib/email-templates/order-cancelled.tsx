import * as React from 'react';
import type { TemplateEntry } from './registry';
import {
  EmailShell, EmailH1, EmailText, EmailSection, EmailInfoCard,
} from './_shared';

interface Props {
  clientName?: string;
  orderId?: string;
  reason?: string | null;
}

export function OrderCancelledEmail({ clientName = 'клиент', orderId = '—', reason }: Props) {
  return (
    <EmailShell preview={`Заказ #${orderId} отменён`} variant="danger">
      <EmailSection top={20}>
        <EmailH1>Заказ отменён</EmailH1>
        <EmailText>
          {clientName}, ваш заказ <strong>#{orderId}</strong> отменён.
        </EmailText>
      </EmailSection>

      {reason && (
        <EmailInfoCard variant="danger">
          <EmailText><strong>Причина: </strong>{reason}</EmailText>
        </EmailInfoCard>
      )}

      <EmailSection>
        <EmailText>
          Если это произошло по ошибке — напишите нам, и мы поможем восстановить заказ.
        </EmailText>
      </EmailSection>
    </EmailShell>
  );
}

export const template = {
  component: OrderCancelledEmail,
  subject: (d: Record<string, unknown>) => `Заказ #${(d.orderId as string) ?? ''} отменён`,
  displayName: 'Клиенту: заказ отменён',
  previewData: { clientName: 'Иван', orderId: 'ord_abc123', reason: 'Отмена по запросу клиента' },
} satisfies TemplateEntry;
