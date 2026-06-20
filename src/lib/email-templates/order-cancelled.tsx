import * as React from 'react';
import { Body, Container, Head, Heading, Html, Preview, Text, Hr } from '@react-email/components';
import type { TemplateEntry } from './registry';

interface Props {
  clientName?: string;
  orderId?: string;
  reason?: string | null;
}

export function OrderCancelledEmail({ clientName = 'клиент', orderId = '—', reason }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Заказ #{orderId} отменён</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'system-ui,sans-serif', color: '#1f2937', margin: 0 }}>
        <Container style={{ maxWidth: 600, padding: '24px' }}>
          <Heading style={{ color: '#dc2626' }}>Заказ отменён</Heading>
          <Text>{clientName}, ваш заказ <strong>#{orderId}</strong> отменён.</Text>
          {reason && (<><Hr /><Text>Причина: {reason}</Text></>)}
          <Hr />
          <Text>Если это произошло по ошибке — напишите нам, мы поможем восстановить заказ.</Text>
          <Text style={{ marginTop: 24, fontSize: 12, color: '#6b7280' }}>event-hub.by</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: OrderCancelledEmail,
  subject: (d: Record<string, unknown>) => `Заказ #${(d.orderId as string) ?? ''} отменён`,
  displayName: 'Клиенту: заказ отменён',
  previewData: { clientName: 'Иван', orderId: 'ord_abc123', reason: 'Отмена по запросу клиента' },
} satisfies TemplateEntry;
