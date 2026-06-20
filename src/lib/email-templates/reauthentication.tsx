import * as React from 'react';
import { EmailShell, EmailH1, EmailText, EmailSection, EmailCode } from './_shared';

interface ReauthenticationEmailProps {
  token: string;
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <EmailShell preview="Ваш код подтверждения">
    <EmailSection top={20}>
      <EmailH1>Подтвердите вход</EmailH1>
      <EmailText>Используйте этот код, чтобы подтвердить личность:</EmailText>
    </EmailSection>

    <EmailCode>{token}</EmailCode>

    <EmailSection>
      <EmailText muted small>
        Код действует ограниченное время. Если вы не запрашивали подтверждение — проигнорируйте письмо.
      </EmailText>
    </EmailSection>
  </EmailShell>
);

export default ReauthenticationEmail;
