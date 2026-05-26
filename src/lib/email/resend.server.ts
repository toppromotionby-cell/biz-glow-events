// Resend gateway helper — массовые маркетинговые email через коннектор Lovable.
// Аутентификация: LOVABLE_API_KEY (Bearer) + RESEND_API_KEY (X-Connection-Api-Key).
// ВНИМАНИЕ: только server-only. Никогда не импортировать в клиентский код.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export type ResendSendArgs = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
  headers?: Record<string, string>;
};

export type ResendSendResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string };

export async function sendViaResend(args: ResendSendArgs): Promise<ResendSendResult> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!LOVABLE_API_KEY) return { ok: false, status: 0, error: "LOVABLE_API_KEY is not configured" };
  if (!RESEND_API_KEY) return { ok: false, status: 0, error: "RESEND_API_KEY is not configured (Resend connector not linked)" };

  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify(args),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && typeof data === "object" && (data as any).message) || JSON.stringify(data);
    return { ok: false, status: res.status, error: `[${res.status}] ${msg}` };
  }
  return { ok: true, id: (data as { id?: string }).id ?? "" };
}
