import * as React from 'react';
import { Body, Container, Head, Heading, Html, Preview, Text, Hr } from '@react-email/components';
import type { TemplateEntry } from './registry';

interface Props {
  clientName?: string;
  orderId?: string;
  total?: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('ru-BY', { style: 'currency', currency: 'BYN', maximumFractionDigits: 0 }).format(n);

export function OrderPaidEmail({ clientName = 'клиент', orderId = '—', total = 0 }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Оплата по заказу #{orderId} получена</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'system-ui,sans-serif', color: '#1f2937', margin: 0 }}>
        <Container style={{ maxWidth: 600, padding: '24px' }}>
          <Heading style={{ color: '#16a34a' }}>Оплата получена</Heading>
          <Text>Спасибо, {clientName}!</Text>
          <Text>Мы получили оплату по заказу <strong>#{orderId}</strong>{total > 0 ? <> на сумму <strong>{fmt(total)}</strong></> : null}.</Text>
          <Hr />
          <Text>Мы свяжемся с вами по деталям мероприятия в ближайшее время.</Text>
          <Text style={{ marginTop: 24, fontSize: 12, color: '#6b7280' }}>event-hub.by</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: OrderPaidEmail,
  subject: (d: Record<string, unknown>) => `Оплата по заказу #${(d.orderId as string) ?? ''} получена`,
  displayName: 'Клиенту: оплата получена',
  previewData: { clientName: 'Иван', orderId: 'ord_abc123', total: 1500 },
} satisfies TemplateEntry;
