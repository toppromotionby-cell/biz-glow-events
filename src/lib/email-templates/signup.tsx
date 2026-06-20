import * as React from 'react';
import {
  EmailShell, EmailH1, EmailText, EmailSection, EmailButton, EmailLink, EMAIL_TOKENS,
} from './_shared';

interface SignupEmailProps {
  siteName: string;
  siteUrl: string;
  recipient: string;
  confirmationUrl: string;
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <EmailShell preview={`Подтвердите email для ${siteName}`}>
    <EmailSection top={20}>
      <EmailH1>Подтвердите email</EmailH1>
      <EmailText>
        Спасибо за регистрацию в{' '}
        <EmailLink href={siteUrl}><strong>{siteName}</strong></EmailLink>!
      </EmailText>
      <EmailText>
        Подтвердите ваш адрес{' '}
        <EmailLink href={`mailto:${recipient}`}>{recipient}</EmailLink>, нажав на кнопку ниже:
      </EmailText>
    </EmailSection>

    <EmailButton href={confirmationUrl}>Подтвердить email</EmailButton>

    <EmailSection>
      <EmailText muted small>
        Если вы не регистрировались на {siteName}, просто проигнорируйте это письмо.
      </EmailText>
    </EmailSection>
  </EmailShell>
);

export default SignupEmail;

// Backwards-compat: export tokens for any direct importers
export { EMAIL_TOKENS };
