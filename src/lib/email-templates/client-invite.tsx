import * as React from 'react';
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from '@react-email/components';
import type { TemplateEntry } from './registry';

interface ClientInviteProps {
  recipientName?: string;
  personalMessage?: string;
}

const ACCENT = '#f0a040';
const ACCENT_DARK = '#d97706';
const TEXT = '#1f2937';
const MUTED = '#6b7280';
const SITE_URL = 'https://event-hub.by';

export function ClientInviteEmail({ recipientName, personalMessage }: ClientInviteProps) {
  const greetingName = (recipientName ?? '').trim();
  const greeting = greetingName ? `Здравствуйте, ${greetingName}!` : 'Здравствуйте!';

  return (
    <Html>
      <Head />
      <Preview>Приглашаем познакомиться с event-hub.by — площадки, оборудование и услуги для ваших мероприятий</Preview>
      <Body style={{ backgroundColor: '#ffffff', color: TEXT, fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '0' }}>
          {/* Акцентная полоса */}
          <div style={{ height: '6px', background: `linear-gradient(90deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)` }} />

          <Section style={{ padding: '32px 32px 8px' }}>
            <Text style={{ margin: 0, fontSize: '14px', color: ACCENT_DARK, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              event-hub.by
            </Text>
            <Heading as="h1" style={{ margin: '12px 0 8px', fontSize: '26px', lineHeight: '1.25', color: TEXT }}>
              {greeting}
            </Heading>
            <Text style={{ margin: 0, fontSize: '16px', lineHeight: '1.55', color: TEXT }}>
              Хотим познакомить вас с <strong>event-hub.by</strong> — сервисом, который помогает быстро организовать мероприятие любого масштаба: от частного праздника до корпоративного события.
            </Text>
          </Section>

          {personalMessage && personalMessage.trim() && (
            <Section style={{ padding: '8px 32px 0' }}>
              <div style={{ background: '#fff7ed', borderLeft: `3px solid ${ACCENT}`, padding: '14px 18px', borderRadius: '6px' }}>
                <Text style={{ margin: 0, fontSize: '15px', lineHeight: '1.55', color: TEXT, whiteSpace: 'pre-wrap' as const }}>
                  {personalMessage.trim()}
                </Text>
              </div>
            </Section>
          )}

          <Section style={{ padding: '20px 32px 0' }}>
            <Heading as="h2" style={{ margin: '0 0 12px', fontSize: '17px', color: TEXT }}>
              Что вы найдёте у нас
            </Heading>
            <Text style={{ margin: '6px 0', fontSize: '15px', lineHeight: '1.55', color: TEXT }}>
              • <strong>Зоны и площадки</strong> — готовые лофты, шатры, открытые пространства
            </Text>
            <Text style={{ margin: '6px 0', fontSize: '15px', lineHeight: '1.55', color: TEXT }}>
              • <strong>Техника и оборудование</strong> — свет, звук, видео, мебель в аренду
            </Text>
            <Text style={{ margin: '6px 0', fontSize: '15px', lineHeight: '1.55', color: TEXT }}>
              • <strong>Услуги</strong> — ведущие, артисты, кейтеринг, декор, координация
            </Text>
            <Text style={{ margin: '6px 0', fontSize: '15px', lineHeight: '1.55', color: TEXT }}>
              • <strong>Производство «под ключ»</strong> — рассчитаем смету и проведём событие
            </Text>
          </Section>

          <Section style={{ padding: '24px 32px 8px' }}>
            <Heading as="h2" style={{ margin: '0 0 12px', fontSize: '17px', color: TEXT }}>
              Почему с нами удобно
            </Heading>
            <Text style={{ margin: '6px 0', fontSize: '15px', lineHeight: '1.55', color: TEXT }}>
              ✓ Прозрачный каталог с ценами — расчёт за минуты
            </Text>
            <Text style={{ margin: '6px 0', fontSize: '15px', lineHeight: '1.55', color: TEXT }}>
              ✓ Готовые комплекты под формат события
            </Text>
            <Text style={{ margin: '6px 0', fontSize: '15px', lineHeight: '1.55', color: TEXT }}>
              ✓ Личный менеджер на связи в Telegram и WhatsApp
            </Text>
          </Section>

          <Section style={{ padding: '28px 32px 8px', textAlign: 'center' as const }}>
            <Button
              href={SITE_URL}
              style={{
                background: `linear-gradient(90deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`,
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: 600,
                padding: '14px 32px',
                borderRadius: '10px',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Перейти в каталог
            </Button>
            <Text style={{ margin: '12px 0 0', fontSize: '13px', color: MUTED }}>
              или откройте сайт: <Link href={SITE_URL} style={{ color: ACCENT_DARK }}>event-hub.by</Link>
            </Text>
          </Section>

          <Hr style={{ borderColor: '#e5e7eb', margin: '28px 32px 0' }} />

          <Section style={{ padding: '20px 32px 32px' }}>
            <Text style={{ margin: '0 0 6px', fontSize: '13px', color: MUTED }}>
              Связаться с нами:
            </Text>
            <Text style={{ margin: '4px 0', fontSize: '14px', color: TEXT }}>
              Телефон: <Link href="tel:+375447099122" style={{ color: TEXT }}>+375 44 709-91-22</Link>
            </Text>
            <Text style={{ margin: '4px 0', fontSize: '14px', color: TEXT }}>
              Telegram: <Link href="https://t.me/+375447099122" style={{ color: ACCENT_DARK }}>@event-hub.by</Link>
            </Text>
            <Text style={{ margin: '4px 0', fontSize: '14px', color: TEXT }}>
              Email: <Link href="mailto:hello@event-hub.by" style={{ color: ACCENT_DARK }}>hello@event-hub.by</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
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
