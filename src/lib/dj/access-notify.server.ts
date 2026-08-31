// Уведомления диджею о решении по заявке: письмо со ссылкой прямо в раздел
// и (если привязан Telegram) личное сообщение с тем же адресом.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendDjMembershipEmail } from "@/lib/admin-email.server";
import { djAbsoluteUrl, DJ_DEFAULT_RETURN } from "@/lib/dj/return-to";
import type { DjMemberStatus } from "./types";

export type DjDecision = "approved" | "rejected" | "blocked";

/** Статусы, о которых имеет смысл писать диджею. */
export function decisionFor(status: DjMemberStatus): DjDecision | null {
  if (status === "approved" || status === "trusted") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "blocked") return "blocked";
  return null;
}

export async function notifyMembershipDecision(
  member: { id: string; user_id: string; nickname?: string | null },
  status: DjMemberStatus,
): Promise<void> {
  const decision = decisionFor(status);
  if (!decision) return;

  // Email
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", member.user_id)
      .maybeSingle();
    const email = (profile?.email ?? "").trim();
    if (email) {
      await sendDjMembershipEmail({
        to: email,
        nickname: member.nickname ?? null,
        decision,
        path: DJ_DEFAULT_RETURN,
      });
    }
  } catch (e) {
    console.error("[dj] membership email failed", e);
  }

  // Telegram — только про открытый доступ, ссылкой в раздел.
  if (decision !== "approved") return;
  try {
    const { linksByUser } = await import("./telegram/store.server");
    const { enqueue } = await import("./telegram/store.server");
    const links = await linksByUser(member.user_id);
    const text = `🎧 Доступ в DJ-клуб открыт!\nБиблиотека треков и софт: ${djAbsoluteUrl(DJ_DEFAULT_RETURN)}`;
    for (const l of links) await enqueue("text", { text }, l.chat_id);
  } catch (e) {
    console.error("[dj] membership telegram failed", e);
  }
}
