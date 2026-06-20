import * as React from 'react';
import { Body, Container, Head, Heading, Html, Preview, Text, Hr, Button } from '@react-email/components';
import type { TemplateEntry } from './registry';

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
    <Html>
      <Head />
      <Preview>Заказ #{orderId} завершён</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'system-ui,sans-serif', color: '#1f2937', margin: 0 }}>
        <Container style={{ maxWidth: 600, padding: '24px' }}>
          <Heading style={{ color: '#d97706' }}>Спасибо, что были с нами!</Heading>
          <Text>{clientName}, ваш заказ <strong>#{orderId}</strong> завершён.</Text>
          <Text>Будем благодарны за обратную связь — это поможет нам стать лучше.</Text>
          <Hr />
          <Button href={reviewUrl} style={{ backgroundColor: '#d97706', color: '#fff', padding: '12px 20px', borderRadius: 8, textDecoration: 'none' }}>
            Оставить отзыв
          </Button>
          <Text style={{ marginTop: 24, fontSize: 12, color: '#6b7280' }}>event-hub.by</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: OrderCompletedEmail,
  subject: (d: Record<string, unknown>) => `Заказ #${(d.orderId as string) ?? ''} завершён`,
  displayName: 'Клиенту: заказ завершён',
  previewData: { clientName: 'Иван', orderId: 'ord_abc123', reviewUrl: 'https://event-hub.by/profile' },
} satisfies TemplateEntry;
