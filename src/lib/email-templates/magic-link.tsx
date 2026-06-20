import * as React from 'react';
import { EmailShell, EmailH1, EmailText, EmailSection, EmailButton } from './_shared';

interface MagicLinkEmailProps {
  siteName: string;
  confirmationUrl: string;
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <EmailShell preview={`Ваша ссылка для входа в ${siteName}`}>
    <EmailSection top={20}>
      <EmailH1>Ссылка для входа</EmailH1>
      <EmailText>
        Нажмите на кнопку ниже, чтобы войти в {siteName}. Ссылка действует ограниченное время.
      </EmailText>
    </EmailSection>

    <EmailButton href={confirmationUrl}>Войти</EmailButton>

    <EmailSection>
      <EmailText muted small>
        Если вы не запрашивали ссылку для входа, просто проигнорируйте это письмо.
      </EmailText>
    </EmailSection>
  </EmailShell>
);

export default MagicLinkEmail;
