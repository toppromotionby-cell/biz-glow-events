import * as React from 'react';
import type { TemplateEntry } from './registry';
import {
  EmailShell, EmailH1, EmailH2, EmailText, EmailSection, EmailInfoCard, EmailButton, EMAIL_TOKENS,
} from './_shared';

interface ClientInviteProps {
  recipientName?: string;
  personalMessage?: string;
}

export function ClientInviteEmail({ recipientName, personalMessage }: ClientInviteProps) {
  const greetingName = (recipientName ?? '').trim();
  const greeting = greetingName ? `Здравствуйте, ${greetingName}!` : 'Здравствуйте!';

  return (
    <EmailShell preview="Приглашаем познакомиться с event-hub.by — площадки, оборудование и услуги для ваших мероприятий">
      <EmailSection top={20}>
        <EmailH1>{greeting}</EmailH1>
        <EmailText>
          Хотим познакомить вас с <strong style={{ color: EMAIL_TOKENS.ACCENT }}>event-hub.by</strong> — сервисом, который помогает быстро организовать мероприятие любого масштаба: от частного праздника до корпоративного события.
        </EmailText>
      </EmailSection>

      {personalMessage && personalMessage.trim() && (
        <EmailInfoCard>
          <EmailText>
            <span style={{ whiteSpace: 'pre-wrap' as const }}>{personalMessage.trim()}</span>
          </EmailText>
        </EmailInfoCard>
      )}

      <EmailSection>
        <EmailH2>Что вы найдёте у нас</EmailH2>
        <EmailText>• <strong>Зоны и площадки</strong> — готовые лофты, шатры, открытые пространства</EmailText>
        <EmailText>• <strong>Техника и оборудование</strong> — свет, звук, видео, мебель в аренду</EmailText>
        <EmailText>• <strong>Услуги</strong> — ведущие, артисты, кейтеринг, декор, координация</EmailText>
        <EmailText>• <strong>Производство «под ключ»</strong> — рассчитаем смету и проведём событие</EmailText>
      </EmailSection>

      <EmailSection>
        <EmailH2>Почему с нами удобно</EmailH2>
        <EmailText>✓ Прозрачный каталог с ценами — расчёт за минуты</EmailText>
        <EmailText>✓ Готовые комплекты под формат события</EmailText>
        <EmailText>✓ Личный менеджер на связи в Telegram и WhatsApp</EmailText>
      </EmailSection>

      <EmailButton href={EMAIL_TOKENS.SITE_URL}>Перейти в каталог</EmailButton>
    </EmailShell>
  );
}

export const template = {
  component: ClientInviteEmail,
  subject: (data: Record<string, unknown>) => {
    const name = ((data.recipientName as string) ?? '').trim();
    return name ? `${name}, приглашаем в event-hub.by` : 'Приглашаем в event-hub.by';
  },
  displayName: 'Приглашение клиенту',
  previewData: {
    recipientName: 'Анна',
    personalMessage: 'Подобрали для вас несколько вариантов площадок к лету — будем рады обсудить детали.',
  },
} satisfies TemplateEntry;
