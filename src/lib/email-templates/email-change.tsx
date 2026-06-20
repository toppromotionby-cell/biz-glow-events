import * as React from 'react';
import { EmailShell, EmailH1, EmailText, EmailSection, EmailButton, EmailLink } from './_shared';

interface EmailChangeEmailProps {
  siteName: string;
  oldEmail: string;
  email: string;
  newEmail: string;
  confirmationUrl: string;
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <EmailShell preview={`Подтвердите смену email для ${siteName}`}>
    <EmailSection top={20}>
      <EmailH1>Подтвердите смену email</EmailH1>
      <EmailText>
        Вы запросили смену адреса для {siteName} с{' '}
        <EmailLink href={`mailto:${oldEmail}`}>{oldEmail}</EmailLink>{' '}
        на{' '}
        <EmailLink href={`mailto:${newEmail}`}>{newEmail}</EmailLink>.
      </EmailText>
      <EmailText>Нажмите кнопку ниже, чтобы подтвердить изменение:</EmailText>
    </EmailSection>

    <EmailButton href={confirmationUrl}>Подтвердить смену email</EmailButton>

    <EmailSection>
      <EmailText muted small>
        Если вы не запрашивали смену — немедленно защитите свой аккаунт.
      </EmailText>
    </EmailSection>
  </EmailShell>
);

export default EmailChangeEmail;
