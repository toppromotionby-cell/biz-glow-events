import * as React from 'react';
import { Section } from '@react-email/components';
import type { TemplateEntry } from './registry';
import {
  EmailShell, EmailH1, EmailH2, EmailText, EmailSection, EmailInfoCard, EmailField, EmailLink,
} from './_shared';

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
    <EmailShell preview={`Новая заявка от ${clientName}`}>
      <EmailSection top={20}>
        <EmailH1>Новая заявка</EmailH1>
        <EmailText muted small>Уведомление для команды event-hub.by</EmailText>
      </EmailSection>

      <EmailInfoCard>
        <EmailField label="ID заявки" value={<strong>{leadId}</strong>} />
        <EmailField label="Источник" value={source} />
      </EmailInfoCard>

      <EmailSection>
        <EmailH2>Клиент</EmailH2>
        <EmailField label="Имя" value={clientName} />
        <EmailField label="Телефон" value={clientPhone} />
        {clientEmail && clientEmail !== '—' && (
          <EmailField label="Email" value={<EmailLink href={`mailto:${clientEmail}`}>{clientEmail}</EmailLink>} />
        )}
      </EmailSection>

      {notes && (
        <>
          <EmailSection>
            <EmailH2>Комментарий</EmailH2>
          </EmailSection>
          <EmailInfoCard>
            <EmailText>{notes}</EmailText>
          </EmailInfoCard>
        </>
      )}

      <Section style={{ height: 8 }} />
    </EmailShell>
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
