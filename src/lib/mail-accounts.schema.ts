// Общая Zod-схема для mail_accounts: используется и на клиенте (форма),
// и на сервере (createServerFn .inputValidator).
import { z } from "zod";

// hostname: буквы/цифры/точки/дефисы, без пробелов и протокола
const HOSTNAME_RE = /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export const hostnameSchema = z
  .string()
  .trim()
  .min(3, "Хост слишком короткий")
  .max(253, "Хост слишком длинный")
  .regex(HOSTNAME_RE, "Некорректный hostname (без http://, без пробелов, например imap.example.com)");

export const portSchema = z
  .number({ message: "Порт должен быть числом" })
  .int("Порт — целое число")
  .min(1, "Порт от 1 до 65535")
  .max(65535, "Порт от 1 до 65535");

const STANDARD_IMAP_SSL = new Set([993]);
const STANDARD_IMAP_PLAIN = new Set([143]);
const STANDARD_SMTP_SSL = new Set([465]);
const STANDARD_SMTP_PLAIN = new Set([25, 587, 2525]);

// Базовая часть без cross-field проверок — пригодна и для .partial() в update
export const accountBaseSchema = z.object({
  email: z.string().trim().toLowerCase().email("Некорректный email").max(255),
  username: z.string().trim().max(255).nullable().optional(),
  display_name: z.string().trim().max(255).nullable().optional(),
  password: z
    .string()
    .min(4, "Пароль слишком короткий (мин. 4 символа)")
    .max(1024, "Пароль слишком длинный")
    .nullable()
    .optional(),
  provider: z.string().trim().min(1).default("imap"),
  imap_host: hostnameSchema,
  imap_port: portSchema.default(993),
  imap_secure: z.boolean().default(true),
  smtp_host: hostnameSchema,
  smtp_port: portSchema.default(465),
  smtp_secure: z.boolean().default(true),
});

function checkSslPair(
  port: number,
  secure: boolean,
  sslSet: Set<number>,
  plainSet: Set<number>,
  label: "IMAP" | "SMTP",
  ctx: z.RefinementCtx,
  portPath: string,
  securePath: string,
) {
  if (sslSet.has(port) && !secure) {
    ctx.addIssue({
      code: "custom",
      path: [securePath],
      message: `Порт ${port} (${label}) обычно требует SSL — включите SSL`,
    });
  }
  if (plainSet.has(port) && secure) {
    ctx.addIssue({
      code: "custom",
      path: [securePath],
      message: `Порт ${port} (${label}) обычно без SSL/STARTTLS — выключите SSL`,
    });
  }
  // явно неподдерживаемые порты <1024, не из списка — мягкое предупреждение через ошибку
  if (port < 1024 && !sslSet.has(port) && !plainSet.has(port)) {
    ctx.addIssue({
      code: "custom",
      path: [portPath],
      message: `Нестандартный системный порт для ${label}`,
    });
  }
}

export const accountCreateSchema = accountBaseSchema
  .extend({
    password: z
      .string()
      .min(4, "Пароль обязателен (мин. 4 символа)")
      .max(1024, "Пароль слишком длинный"),
  })
  .superRefine((v, ctx) => {
    checkSslPair(v.imap_port, v.imap_secure, STANDARD_IMAP_SSL, STANDARD_IMAP_PLAIN, "IMAP", ctx, "imap_port", "imap_secure");
    checkSslPair(v.smtp_port, v.smtp_secure, STANDARD_SMTP_SSL, STANDARD_SMTP_PLAIN, "SMTP", ctx, "smtp_port", "smtp_secure");
  });

export const accountUpdateSchema = accountBaseSchema
  .partial()
  .superRefine((v, ctx) => {
    if (v.imap_port !== undefined && v.imap_secure !== undefined) {
      checkSslPair(v.imap_port, v.imap_secure, STANDARD_IMAP_SSL, STANDARD_IMAP_PLAIN, "IMAP", ctx, "imap_port", "imap_secure");
    }
    if (v.smtp_port !== undefined && v.smtp_secure !== undefined) {
      checkSslPair(v.smtp_port, v.smtp_secure, STANDARD_SMTP_SSL, STANDARD_SMTP_PLAIN, "SMTP", ctx, "smtp_port", "smtp_secure");
    }
  });

export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;
