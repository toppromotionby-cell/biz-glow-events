import * as React from 'react';
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr } from '@react-email/components';
import type { TemplateEntry } from './registry';

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
    <Html>
      <Head />
      <Preview>Заказ #{orderId} подтверждён</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'system-ui,sans-serif', color: '#1f2937', margin: 0 }}>
        <Container style={{ maxWidth: 600, padding: '24px' }}>
          <Heading style={{ color: '#d97706' }}>Заказ подтверждён</Heading>
          <Text>Здравствуйте, {clientName}!</Text>
          <Text>Ваш заказ <strong>#{orderId}</strong> принят и подтверждён нашей командой.</Text>
          <Hr />
          <Section>
            {eventDate && <Text>Дата мероприятия: <strong>{eventDate}</strong></Text>}
            <Text>Сумма: <strong>{total > 0 ? fmt(total) : 'по запросу'}</strong></Text>
          </Section>
          <Button href={manageUrl} style={{ backgroundColor: '#d97706', color: '#fff', padding: '12px 20px', borderRadius: 8, textDecoration: 'none' }}>
            Открыть личный кабинет
          </Button>
          <Text style={{ marginTop: 24, fontSize: 12, color: '#6b7280' }}>
            event-hub.by — площадки и сервисы для мероприятий
          </Text>
        </Container>
      </Body>
    </Html>
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
