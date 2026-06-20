import * as React from 'react';
import { EmailShell, EmailH1, EmailText, EmailSection, EmailButton } from './_shared';

interface RecoveryEmailProps {
  siteName: string;
  confirmationUrl: string;
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <EmailShell preview={`Сброс пароля для ${siteName}`}>
    <EmailSection top={20}>
      <EmailH1>Сброс пароля</EmailH1>
      <EmailText>
        Мы получили запрос на сброс пароля для {siteName}. Нажмите на кнопку ниже, чтобы задать новый пароль.
      </EmailText>
    </EmailSection>

    <EmailButton href={confirmationUrl}>Сбросить пароль</EmailButton>

    <EmailSection>
      <EmailText muted small>
        Если вы не запрашивали сброс — просто проигнорируйте это письмо, пароль не изменится.
      </EmailText>
    </EmailSection>
  </EmailShell>
);

export default RecoveryEmail;
