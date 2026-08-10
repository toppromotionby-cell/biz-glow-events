// Автосоздание личного кабинета клиента после оформления заказа.
// Регистрации на сайте нет: аккаунт заводится здесь, доступ уходит на почту.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SPECIALS = "!@#$%*-_";

/** Криптостойкий временный пароль: 14 символов + гарантированный спецсимвол. */
export function generateTempPassword(): string {
  const len = 14;
  const bytes = new Uint32Array(len);
  globalThis.crypto.getRandomValues(bytes);
  const chars: string[] = [];
  for (let i = 0; i < len; i++) {
    chars.push(ALPHABET[bytes[i] % ALPHABET.length]);
  }
  const pos = bytes[0] % len;
  chars[pos] = SPECIALS[bytes[1] % SPECIALS.length];
  return chars.join("");
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  // profiles.email заполняется триггером handle_new_user — самый дешёвый путь.
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (profile?.id) return profile.id;

  // Фолбэк: аккаунты без профиля (например, OAuth) ищем через Admin API.
  try {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = data?.users?.find(
      (u) => (u.email ?? "").toLowerCase() === email,
    );
    return found?.id ?? null;
  } catch {
    return null;
  }
}

export type EnsureAccountResult = {
  userId: string | null;
  tempPassword: string | null;
  created: boolean;
};

/**
 * Возвращает id кабинета клиента по email, создавая его при необходимости.
 * Никогда не бросает — сбой не должен ронять оформление заказа.
 */
export async function ensureClientAccount(input: {
  email: string;
  fullName?: string | null;
  phone?: string | null;
  company?: string | null;
}): Promise<EnsureAccountResult> {
  const email = (input.email ?? "").trim().toLowerCase();
  if (!email) return { userId: null, tempPassword: null, created: false };

  try {
    const existing = await findUserIdByEmail(email);
    if (existing) return { userId: existing, tempPassword: null, created: false };

    const tempPassword = generateTempPassword();
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: input.fullName ?? "",
        phone: input.phone ?? "",
        company: input.company ?? null,
        consent_pd: true,
        must_change_password: true,
        created_via: "order",
      },
    });

    if (error || !data?.user) {
      // Гонка: пользователь мог быть создан параллельным заказом.
      const retry = await findUserIdByEmail(email);
      if (retry) return { userId: retry, tempPassword: null, created: false };
      console.error("[ensureClientAccount] createUser failed:", error);
      return { userId: null, tempPassword: null, created: false };
    }

    return { userId: data.user.id, tempPassword, created: true };
  } catch (e) {
    console.error("[ensureClientAccount] unexpected error:", e);
    return { userId: null, tempPassword: null, created: false };
  }
}
