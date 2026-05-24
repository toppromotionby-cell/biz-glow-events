import * as React from 'react';
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text, Link,
} from '@react-email/components';
import type { TemplateEntry } from './registry';

interface AdminLeadProps {
  leadId?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  source?: string;
  notes?: string | null;
}

export function AdminLeadEmail(props: AdminLeadProps) {
  const { leadId = '—', clientName = '—', clientPhone = '—', clientEmail = '—', source = '—', notes } = props;
  return (
    <Html>
      <Head />
      <Preview>Новая заявка от {clientName}</Preview>
      <Body style={{ backgroundColor: '#0a0a0f', color: '#e5e5e5', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
        <Container style={{ padding: '24px', maxWidth: '600px' }}>
          <Heading style={{ color: '#a78bfa' }}>Новая заявка</Heading>
          <Text>ID: <strong>{leadId}</strong></Text>
          <Text>Источник: {source}</Text>
          <Hr />
          <Section>
            <Text>{clientName}</Text>
            <Text>
              Тел: {clientPhone}
              {clientEmail !== '—' && <> · Email: <Link href={`mailto:${clientEmail}`}>{clientEmail}</Link></>}
            </Text>
            {notes && <Text>Комментарий: {notes}</Text>}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: AdminLeadEmail,
  subject: (data: Record<string, unknown>) => `Новая заявка от ${(data.clientName as string) ?? 'клиента'}`,
  displayName: 'Уведомление администратору о заявке',
  previewData: {
    leadId: 'lead_xyz',
    clientName: 'Анна Петрова',
    clientPhone: '+375 29 765-43-21',
    clientEmail: 'anna@example.com',
    source: 'contacts',
    notes: 'Интересует фотозона на 50 человек',
  },
} satisfies TemplateEntry;
