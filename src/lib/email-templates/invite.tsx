import * as React from 'react';
import { EmailShell, EmailH1, EmailText, EmailSection, EmailButton, EmailLink } from './_shared';

interface InviteEmailProps {
  siteName: string;
  siteUrl: string;
  confirmationUrl: string;
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <EmailShell preview={`Вас пригласили в ${siteName}`}>
    <EmailSection top={20}>
      <EmailH1>Вас пригласили</EmailH1>
      <EmailText>
        Вас пригласили присоединиться к{' '}
        <EmailLink href={siteUrl}><strong>{siteName}</strong></EmailLink>. Нажмите кнопку ниже, чтобы принять приглашение и создать аккаунт.
      </EmailText>
    </EmailSection>

    <EmailButton href={confirmationUrl}>Принять приглашение</EmailButton>

    <EmailSection>
      <EmailText muted small>
        Если вы не ожидали этого приглашения, просто проигнорируйте письмо.
      </EmailText>
    </EmailSection>
  </EmailShell>
);

export default InviteEmail;
