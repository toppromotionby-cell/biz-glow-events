import * as React from 'react';
import { Section, Hr } from '@react-email/components';
import type { TemplateEntry } from './registry';
import {
  EmailShell, EmailH1, EmailH2, EmailText, EmailSection, EmailInfoCard, EmailField, EmailLink, EMAIL_TOKENS,
} from './_shared';

interface AdminOrderProps {
  orderId?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientCompany?: string | null;
  total?: number;
  eventDate?: string | null;
  source?: string;
  notes?: string | null;
  items?: Array<{ title: string; qty: number; price: number }>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 0 }).format(n);

export function AdminOrderEmail(props: AdminOrderProps) {
  const {
    orderId = '—', clientName = '—', clientPhone = '—', clientEmail = '—',
    clientCompany, total = 0, eventDate, source = '—', notes, items = [],
  } = props;
  return (
    <EmailShell preview={`Новый заказ от ${clientName} — ${fmt(total)}`}>
      <EmailSection top={20}>
        <EmailH1>Новый заказ</EmailH1>
        <EmailText muted small>Уведомление для команды event-hub.by</EmailText>
      </EmailSection>

      <EmailInfoCard>
        <EmailField label="ID заказа" value={<strong>{orderId}</strong>} />
        <EmailField label="Источник" value={source} />
        {eventDate && <EmailField label="Дата мероприятия" value={eventDate} />}
      </EmailInfoCard>

      <EmailSection>
        <EmailH2>Клиент</EmailH2>
        <EmailField label="Имя" value={`${clientName}${clientCompany ? ` · ${clientCompany}` : ''}`} />
        <EmailField label="Телефон" value={clientPhone} />
        <EmailField label="Email" value={<EmailLink href={`mailto:${clientEmail}`}>{clientEmail}</EmailLink>} />
        {notes && <EmailField label="Комментарий" value={notes} />}
      </EmailSection>

      <EmailSection>
        <EmailH2>Позиции ({items.length})</EmailH2>
      </EmailSection>
      <EmailInfoCard>
        {items.map((it, i) => (
          <EmailText key={i}>
            • {it.title} — {it.qty} × {it.price > 0 ? fmt(it.price) : 'по запросу'}
          </EmailText>
        ))}
        <Hr style={{ borderColor: EMAIL_TOKENS.BORDER, margin: '12px 0' }} />
        <EmailText>
          <strong style={{ fontSize: '17px' }}>Итого: {fmt(total)}</strong>
        </EmailText>
      </EmailInfoCard>

      <Section style={{ height: 8 }} />
    </EmailShell>
  );
}

export const template = {
  component: AdminOrderEmail,
  subject: (data: Record<string, unknown>) => {
    const name = (data.clientName as string) ?? 'клиента';
    const total = (data.total as number) ?? 0;
    return `Новый заказ от ${name} — ${fmt(total)}`;
  },
  displayName: 'Уведомление администратору о заказе',
  previewData: {
    orderId: 'ord_abc123',
    clientName: 'Иван Иванов',
    clientPhone: '+375 29 123-45-67',
    clientEmail: 'ivan@example.com',
    clientCompany: null,
    total: 1500,
    eventDate: '2026-06-15',
    source: 'cart',
    notes: 'Нужна площадка с панорамным видом',
    items: [
      { title: 'Зона "Лофт"', qty: 1, price: 1000 },
      { title: 'Световое оборудование', qty: 1, price: 500 },
    ],
  },
} satisfies TemplateEntry;
