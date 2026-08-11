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
  allow_invalid_cert?: boolean;
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
    /** Разобранный JSON-ответ воркера, если он был. */
    public readonly data: unknown = null,
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

async function warmupWorker(base: string): Promise<void> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5_000);
  try {
    await fetch(`${base}/health`, { signal: ctrl.signal });
  } catch {
    // прогрев best-effort: не валим основной запрос
  } finally {
    clearTimeout(t);
  }
}

async function doFetch(
  base: string,
  secret: string,
  path: WorkerPath,
  payload: unknown,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-worker-secret": secret,
      },
      body: JSON.stringify(payload ?? {}),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function callMailWorker<T = unknown>(
  path: WorkerPath,
  payload: unknown,
  opts?: { timeoutMs?: number; warmup?: boolean; retryOnTimeout?: boolean },
): Promise<T> {
  const { base, secret } = workerEnv();
  const timeoutMs = opts?.timeoutMs ?? 60_000;
  const wantWarmup = opts?.warmup ?? path === "/test";
  const wantRetry = opts?.retryOnTimeout ?? path === "/test";

  if (wantWarmup) await warmupWorker(base);

  const runOnce = async (): Promise<T> => {
    let res: Response;
    try {
      res = await doFetch(base, secret, path, payload, timeoutMs);
    } catch (err) {
      const isAbort =
        (err instanceof Error && (err.name === "AbortError" || /abort/i.test(err.message)));
      if (isAbort) {
        throw new MailWorkerError(
          `Воркер не ответил за ${Math.round(timeoutMs / 1000)} сек (возможно, холодный старт). Повторите попытку через 10–20 секунд.`,
          504,
          path,
        );
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new MailWorkerError(msg, 0, path);
    }
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // not JSON
    }
    if (!res.ok) {
      const errFromJson =
        json && typeof json === "object" && "error" in json
          ? String((json as { error: unknown }).error)
          : "";
      const msg = errFromJson || text || `HTTP ${res.status}`;
      throw new MailWorkerError(msg, res.status, path, json);
    }
    return (json ?? {}) as T;
  };

  try {
    return await runOnce();
  } catch (err) {
    if (
      wantRetry &&
      err instanceof MailWorkerError &&
      (err.status === 504 || err.status === 0)
    ) {
      // Один повтор после прогрева — инстанс мог уже подняться.
      return await runOnce();
    }
    throw err;
  }
}

export async function mailWorkerHealth(): Promise<{ ok: boolean; ts?: number }> {
  const { base } = workerEnv();
  const res = await fetch(`${base}/health`);
  return res.json() as Promise<{ ok: boolean; ts?: number }>;
}
