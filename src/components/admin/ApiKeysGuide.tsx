// Инструкция для сотрудников: где взять бесплатные API-ключи нейросетей и как их подключить.
import { ExternalLink, KeyRound, ShieldCheck } from "lucide-react";

export interface KeyGuideRow {
  label: string;
  env: string;
  url: string;
  where: string;
  note: string;
}

/** Порядок совпадает с приоритетом провайдеров в маршрутизаторе. */
export const KEY_GUIDE: KeyGuideRow[] = [
  {
    label: "Groq — самый быстрый и щедрый",
    env: "GROQ_API_KEY",
    url: "https://console.groq.com/keys",
    where: "console.groq.com → API Keys → Create API Key",
    note: "Регистрация по e-mail или Google, карта не нужна. ~14 400 запросов в сутки бесплатно.",
  },
  {
    label: "Google AI Studio (Gemini)",
    env: "GEMINI_API_KEY",
    url: "https://aistudio.google.com/apikey",
    where: "aistudio.google.com → Get API key → Create API key",
    note: "Нужен любой аккаунт Google. 1 500 запросов в сутки бесплатно.",
  },
  {
    label: "OpenRouter (бесплатные модели)",
    env: "OPENROUTER_API_KEY",
    url: "https://openrouter.ai/keys",
    where: "openrouter.ai → Keys → Create Key",
    note: "Работают модели с пометкой :free. Лимит 50–1000 запросов в сутки.",
  },
  {
    label: "Mistral La Plateforme",
    env: "MISTRAL_API_KEY",
    url: "https://console.mistral.ai/api-keys",
    where: "console.mistral.ai → API Keys → Create new key",
    note: "Бесплатный тариф Experiment: 1 запрос в секунду.",
  },
  {
    label: "GitHub Models",
    env: "GITHUB_MODELS_TOKEN",
    url: "https://github.com/settings/tokens",
    where: "github.com → Settings → Developer settings → Tokens (classic) → Generate new token",
    note: "Права отмечать не нужно — достаточно пустого токена. Лимит небольшой, это резерв.",
  },
];

/** Пошаговая инструкция + таблица ключей. Используется на странице «ИИ-провайдеры и роли». */
export function ApiKeysGuide() {
  return (
    <section className="glass rounded-2xl p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="h-4 w-4" /> Как подключить бесплатные нейросети (инструкция)
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Каждый источник подключается своим ключом. Ключи бесплатные, оформляются за 2–3 минуты и хранятся в защищённых
        настройках проекта, а не в коде и не на странице.
      </p>

      <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-sm">
        <li>Откройте ссылку нужного сервиса из таблицы ниже и зарегистрируйтесь (карта не требуется).</li>
        <li>В личном кабинете создайте новый ключ (кнопка «Create API key» или «Generate token»).</li>
        <li>Скопируйте ключ сразу — второй раз сервис его не покажет.</li>
        <li>
          Передайте ключ администратору проекта: он добавляет его в раздел{" "}
          <b>Настройки проекта → Secrets</b> под точным именем из колонки «Имя ключа» (регистр важен).
        </li>
        <li>
          Вернитесь на эту страницу и обновите её — напротив источника загорится зелёная плашка{" "}
          <b>«Подключён»</b>. После этого помощник начнёт использовать его первым и перестанет тратить платные кредиты.
        </li>
      </ol>

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Сервис</th>
              <th className="px-3 py-2">Где взять ключ</th>
              <th className="px-3 py-2">Имя ключа</th>
            </tr>
          </thead>
          <tbody>
            {KEY_GUIDE.map((k) => (
              <tr key={k.env} className="border-t border-border/50 align-top">
                <td className="px-3 py-2">
                  <div className="font-medium">{k.label}</div>
                  <p className="text-xs text-muted-foreground">{k.note}</p>
                </td>
                <td className="px-3 py-2">
                  <a
                    href={k.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                  >
                    Открыть кабинет <ExternalLink className="h-3 w-3" />
                  </a>
                  <p className="text-xs text-muted-foreground">{k.where}</p>
                </td>
                <td className="px-3 py-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{k.env}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        Никогда не вставляйте ключи в поля на сайте, в письма или в чат — только в защищённые настройки проекта. Если
        ключ где-то засветился, удалите его в кабинете сервиса и создайте новый.
      </p>
    </section>
  );
}
