// Server-only fetch helper для внешнего mail-worker (Render).
// Адрес и секрет лежат в Lovable Cloud secrets: MAIL_WORKER_URL, MAIL_WORKER_SECRET.
// Не импортировать из клиентского кода.

export type MailAccountCfg = {
  email: string;
  username: string;
  password: string;
  display_name?: string | null;
  imap_host: string;
  imap_port?: number;
  imap_secure?: boolean;
  smtp_host: string;
  smtp_port?: number;
  smtp_secure?: boolean;
};

type WorkerPath =
  | "/test"
  | "/folders"
  | "/messages"
  | "/message"
  | "/flag"
  | "/move"
  | "/delete"
  | "/send";

export class MailWorkerError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly path: WorkerPath,
  ) {
    super(message);
    this.name = "MailWorkerError";
  }
}

function workerEnv() {
  const base = process.env.MAIL_WORKER_URL;
  const secret = process.env.MAIL_WORKER_SECRET;
  if (!base || !secret) {
    throw new Error(
      "Mail worker is not configured: MAIL_WORKER_URL/MAIL_WORKER_SECRET missing",
    );
  }
  return { base: base.replace(/\/+$/, ""), secret };
}

export async function callMailWorker<T = unknown>(
  path: WorkerPath,
  payload: unknown,
  opts?: { timeoutMs?: number },
): Promise<T> {
  const { base, secret } = workerEnv();
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), opts?.timeoutMs ?? 60_000);
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-worker-secret": secret,
      },
      body: JSON.stringify(payload ?? {}),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // not JSON
    }
    if (!res.ok) {
      const msg =
        (json && typeof json === "object" && "error" in json && String((json as { error: unknown }).error)) ||
        text ||
        `HTTP ${res.status}`;
      throw new MailWorkerError(msg, res.status, path);
    }
    return (json ?? {}) as T;
  } catch (err) {
    if (err instanceof MailWorkerError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new MailWorkerError(msg, 0, path);
  } finally {
    clearTimeout(timeout);
  }
}

export async function mailWorkerHealth(): Promise<{ ok: boolean; ts?: number }> {
  const { base } = workerEnv();
  const res = await fetch(`${base}/health`);
  return res.json() as Promise<{ ok: boolean; ts?: number }>;
}
