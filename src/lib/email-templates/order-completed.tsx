import * as React from 'react';
import type { TemplateEntry } from './registry';
import { EmailShell, EmailH1, EmailText, EmailSection, EmailButton } from './_shared';

interface Props {
  clientName?: string;
  orderId?: string;
  reviewUrl?: string;
}

export function OrderCompletedEmail({
  clientName = 'клиент',
  orderId = '—',
  reviewUrl = 'https://event-hub.by/profile',
}: Props) {
  return (
    <EmailShell preview={`Заказ #${orderId} завершён`}>
      <EmailSection top={20}>
        <EmailH1>Спасибо, что были с нами!</EmailH1>
        <EmailText>
          {clientName}, ваш заказ <strong>#{orderId}</strong> завершён.
        </EmailText>
        <EmailText>
          Будем благодарны за обратную связь — это поможет нам стать лучше.
        </EmailText>
      </EmailSection>

      <EmailButton href={reviewUrl}>Оставить отзыв</EmailButton>
    </EmailShell>
  );
}

export const template = {
  component: OrderCompletedEmail,
  subject: (d: Record<string, unknown>) => `Заказ #${(d.orderId as string) ?? ''} завершён`,
  displayName: 'Клиенту: заказ завершён',
  previewData: { clientName: 'Иван', orderId: 'ord_abc123', reviewUrl: 'https://event-hub.by/profile' },
} satisfies TemplateEntry;
