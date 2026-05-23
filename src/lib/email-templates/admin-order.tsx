import * as React from 'react';
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text, Link,
} from '@react-email/components';
import type { TemplateEntry } from './registry';

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
    <Html>
      <Head />
      <Preview>Новый заказ от {clientName} — {fmt(total)}</Preview>
      <Body style={{ backgroundColor: '#0a0a0f', color: '#e5e5e5', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
        <Container style={{ padding: '24px', maxWidth: '600px' }}>
          <Heading style={{ color: '#a78bfa' }}>Новый заказ</Heading>
          <Text>ID: <strong>{orderId}</strong></Text>
          <Text>Источник: {source}</Text>
          <Hr />
          <Section>
            <Heading as="h2" style={{ fontSize: '18px' }}>Клиент</Heading>
            <Text>{clientName}{clientCompany ? ` · ${clientCompany}` : ''}</Text>
            <Text>
              Тел: <Link href={`tel:${clientPhone}`}>{clientPhone}</Link>
              {' · '}Email: <Link href={`mailto:${clientEmail}`}>{clientEmail}</Link>
            </Text>
            {eventDate && <Text>Дата мероприятия: {eventDate}</Text>}
            {notes && <Text>Комментарий: {notes}</Text>}
          </Section>
          <Hr />
          <Section>
            <Heading as="h2" style={{ fontSize: '18px' }}>Позиции ({items.length})</Heading>
            {items.map((it, i) => (
              <Text key={i} style={{ margin: '4px 0' }}>
                • {it.title} — {it.qty} × {it.price > 0 ? fmt(it.price) : 'по запросу'}
              </Text>
            ))}
            <Hr />
            <Text style={{ fontSize: '18px', fontWeight: 'bold' }}>Итого: {fmt(total)}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
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
