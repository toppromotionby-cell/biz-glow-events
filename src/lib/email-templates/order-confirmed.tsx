import * as React from 'react';
import type { TemplateEntry } from './registry';
import {
  EmailShell, EmailH1, EmailText, EmailSection, EmailInfoCard, EmailField, EmailButton,
} from './_shared';

interface OrderConfirmedProps {
  clientName?: string;
  orderId?: string;
  total?: number;
  eventDate?: string | null;
  manageUrl?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 0 }).format(n);

export function OrderConfirmedEmail({
  clientName = 'клиент',
  orderId = '—',
  total = 0,
  eventDate,
  manageUrl = 'https://event-hub.by/profile',
}: OrderConfirmedProps) {
  return (
    <EmailShell preview={`Заказ #${orderId} подтверждён`} variant="success">
      <EmailSection top={20}>
        <EmailH1>Заказ подтверждён</EmailH1>
        <EmailText>Здравствуйте, {clientName}!</EmailText>
        <EmailText>
          Ваш заказ <strong>#{orderId}</strong> принят и подтверждён нашей командой.
        </EmailText>
      </EmailSection>

      <EmailInfoCard variant="success">
        <EmailField label="Заказ" value={<strong>#{orderId}</strong>} />
        {eventDate && <EmailField label="Дата мероприятия" value={<strong>{eventDate}</strong>} />}
        <EmailField label="Сумма" value={<strong>{total > 0 ? fmt(total) : 'по запросу'}</strong>} />
      </EmailInfoCard>

      <EmailButton href={manageUrl}>Открыть личный кабинет</EmailButton>
    </EmailShell>
  );
}

export const template = {
  component: OrderConfirmedEmail,
  subject: (d: Record<string, unknown>) => `Заказ #${(d.orderId as string) ?? ''} подтверждён`,
  displayName: 'Клиенту: заказ подтверждён',
  previewData: {
    clientName: 'Иван',
    orderId: 'ord_abc123',
    total: 1500,
    eventDate: '2026-07-12',
    manageUrl: 'https://event-hub.by/profile',
  },
} satisfies TemplateEntry;
