// Единый каркас и токены для всех email-шаблонов event-hub.by.
// Тёмная тема, чёрный фон, оранжевый градиент — соответствует дизайн-системе сайта.
import * as React from 'react';
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from '@react-email/components';

export const EMAIL_TOKENS = {
  BG: '#0a0a0a',
  SURFACE: '#141414',
  SURFACE_2: '#1c1c1c',
  BORDER: '#2a2a2a',
  TEXT: '#f5f5f5',
  TEXT_MUTED: '#a1a1aa',
  ACCENT: '#f59e0b',
  ACCENT_2: '#f97316',
  GRADIENT: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
  SUCCESS: '#22c55e',
  SUCCESS_GRADIENT: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
  DANGER: '#ef4444',
  DANGER_GRADIENT: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  FONT_DISPLAY: "'Space Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  FONT_BODY: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  SITE_URL: 'https://event-hub.by',
  PHONE: '+375 44 709-91-22',
  TELEGRAM_URL: 'https://t.me/+375447099122',
  EMAIL: 'hello@event-hub.by',
} as const;

const T = EMAIL_TOKENS;

export type AccentVariant = 'default' | 'success' | 'danger';

const accentFor = (v: AccentVariant = 'default') =>
  v === 'success' ? T.SUCCESS : v === 'danger' ? T.DANGER : T.ACCENT;

const gradientFor = (v: AccentVariant = 'default') =>
  v === 'success' ? T.SUCCESS_GRADIENT : v === 'danger' ? T.DANGER_GRADIENT : T.GRADIENT;

interface ShellProps {
  preview: string;
  variant?: AccentVariant;
  lang?: string;
  children: React.ReactNode;
}

export function EmailShell({ preview, variant = 'default', lang = 'ru', children }: ShellProps) {
  return (
    <Html lang={lang} dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: T.BG,
          color: T.TEXT,
          fontFamily: T.FONT_BODY,
          margin: 0,
          padding: '24px 12px',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <Container
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            background: T.SURFACE,
            borderRadius: '16px',
            overflow: 'hidden',
            border: `1px solid ${T.BORDER}`,
          }}
        >
          <div style={{ height: '4px', background: gradientFor(variant) }} />
          <Section style={{ padding: '28px 32px 0' }}>
            <Text
              style={{
                margin: 0,
                fontSize: '12px',
                color: accentFor(variant),
                fontWeight: 600,
                letterSpacing: '1.5px',
                textTransform: 'uppercase' as const,
              }}
            >
              event-hub.by
            </Text>
          </Section>
          {children}
          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
}

export function EmailH1({ children }: { children: React.ReactNode }) {
  return (
    <Heading
      as="h1"
      style={{
        margin: '12px 0 16px',
        fontSize: '26px',
        lineHeight: '1.25',
        color: T.TEXT,
        fontFamily: T.FONT_DISPLAY,
        fontWeight: 700,
      }}
    >
      {children}
    </Heading>
  );
}

export function EmailH2({ children }: { children: React.ReactNode }) {
  return (
    <Heading
      as="h2"
      style={{
        margin: '0 0 12px',
        fontSize: '17px',
        color: T.TEXT,
        fontFamily: T.FONT_DISPLAY,
        fontWeight: 600,
      }}
    >
      {children}
    </Heading>
  );
}

export function EmailText({
  children,
  muted = false,
  small = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
  small?: boolean;
}) {
  return (
    <Text
      style={{
        margin: '6px 0',
        fontSize: small ? '13px' : '15px',
        lineHeight: '1.6',
        color: muted ? T.TEXT_MUTED : T.TEXT,
      }}
    >
      {children}
    </Text>
  );
}

export function EmailSection({ children, top = 20 }: { children: React.ReactNode; top?: number }) {
  return <Section style={{ padding: `${top}px 32px 0` }}>{children}</Section>;
}

export function EmailInfoCard({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: AccentVariant;
}) {
  return (
    <Section style={{ padding: '12px 32px 0' }}>
      <div
        style={{
          background: T.SURFACE_2,
          border: `1px solid ${T.BORDER}`,
          borderLeft: `3px solid ${accentFor(variant)}`,
          padding: '14px 18px',
          borderRadius: '10px',
        }}
      >
        {children}
      </div>
    </Section>
  );
}

export function EmailButton({
  href,
  children,
  variant = 'default',
}: {
  href: string;
  children: React.ReactNode;
  variant?: AccentVariant;
}) {
  return (
    <Section style={{ padding: '24px 32px 0', textAlign: 'center' as const }}>
      <Button
        href={href}
        style={{
          background: gradientFor(variant),
          color: '#ffffff',
          fontSize: '15px',
          fontWeight: 600,
          padding: '14px 32px',
          borderRadius: '10px',
          textDecoration: 'none',
          display: 'inline-block',
          fontFamily: T.FONT_DISPLAY,
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

export function EmailCode({ children }: { children: React.ReactNode }) {
  return (
    <Section style={{ padding: '20px 32px 0', textAlign: 'center' as const }}>
      <div
        style={{
          display: 'inline-block',
          background: T.SURFACE_2,
          border: `1px solid ${T.BORDER}`,
          borderRadius: '12px',
          padding: '16px 28px',
          fontFamily: 'Menlo, Consolas, "Courier New", monospace',
          fontSize: '26px',
          fontWeight: 700,
          letterSpacing: '6px',
          color: T.ACCENT,
        }}
      >
        {children}
      </div>
    </Section>
  );
}

export function EmailLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ color: T.ACCENT, textDecoration: 'underline' }}>
      {children}
    </Link>
  );
}

export function EmailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Text style={{ margin: '4px 0', fontSize: '14px', lineHeight: '1.5', color: T.TEXT }}>
      <span style={{ color: T.TEXT_MUTED }}>{label}: </span>
      <span style={{ color: T.TEXT }}>{value}</span>
    </Text>
  );
}

export function EmailFooter() {
  return (
    <>
      <Hr style={{ borderColor: T.BORDER, margin: '28px 32px 0' }} />
      <Section style={{ padding: '18px 32px 28px' }}>
        <Text style={{ margin: '0 0 6px', fontSize: '12px', color: T.TEXT_MUTED, textTransform: 'uppercase' as const, letterSpacing: '1px' }}>
          Связаться с нами
        </Text>
        <Text style={{ margin: '4px 0', fontSize: '13px', color: T.TEXT_MUTED }}>
          Телефон:{' '}
          <Link href={`tel:${T.PHONE.replace(/\s/g, '')}`} style={{ color: T.TEXT }}>{T.PHONE}</Link>
        </Text>
        <Text style={{ margin: '4px 0', fontSize: '13px', color: T.TEXT_MUTED }}>
          Telegram:{' '}
          <Link href={T.TELEGRAM_URL} style={{ color: T.ACCENT }}>event-hub.by</Link>
        </Text>
        <Text style={{ margin: '4px 0', fontSize: '13px', color: T.TEXT_MUTED }}>
          Email:{' '}
          <Link href={`mailto:${T.EMAIL}`} style={{ color: T.ACCENT }}>{T.EMAIL}</Link>
        </Text>
        <Text style={{ margin: '14px 0 0', fontSize: '11px', color: T.TEXT_MUTED }}>
          © event-hub.by — площадки, оборудование и услуги для мероприятий ·{' '}
          <Link href={T.SITE_URL} style={{ color: T.TEXT_MUTED, textDecoration: 'underline' }}>
            event-hub.by
          </Link>
        </Text>
      </Section>
    </>
  );
}
