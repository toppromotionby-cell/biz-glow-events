// Мозг DJ-бота: команды, кнопки, свободный текст и голос.
import { transcribeVoice } from "@/lib/calendar/parse.server";
import {
  announceCard,
  confirmButtons,
  decodeCb,
  esc,
  helpText,
  memberButtons,
  memberCard,
  table,
  trackButtons,
  trackCard,
  trackTitle,
  SITE,
} from "./cards";
import {
  BotForbidden,
  dormant,
  findTracks,
  getTrackCard,
  identify,
  memberById,
  members,
  moderate,
  packByName,
  pendingTracks,
  removeTrack,
  setMember,
  stats,
  trackArtworkUrl,
  type BotIdentity,
} from "./actions.server";
import { getSettings, patchSettings, redeemLinkCode, setMuted, unlinkChat } from "./store.server";
import { tgAnswerCallback, tgEdit, tgSend, tgSendPhoto, tgSetMyCommands } from "./transport.server";
import { MEMBER_STATUS_LABEL, type DjMemberStatus } from "@/lib/dj/types";

const MODEL = "google/gemini-3.7-flash";

/* --------------------------------- сообщения --------------------------------- */

export async function handleText(chatId: number, text: string, from?: { username?: string; first_name?: string }) {
  const raw = text.trim();
  const who = await identify(chatId);

  // Код привязки — 8 hex-символов.
  if (/^[0-9A-Fa-f]{8}$/.test(raw)) {
    const userId = await redeemLinkCode(raw, { id: chatId, username: from?.username, first_name: from?.first_name });
    if (!userId) {
      await tgSend(chatId, "Код не найден или истёк. Сгенерируйте новый в разделе диджеинга.");
      return;
    }
    const fresh = await identify(chatId);
    await tgSetMyCommands();
    await tgSend(chatId, `✅ Аккаунт привязан.\n\n${helpText(fresh.role)}`);
    return;
  }

  if (raw.startsWith("/")) {
    await handleCommand(who, raw);
    return;
  }

  if (who.role === "guest") {
    await tgSend(chatId, helpText("guest"));
    return;
  }

  await handleFreeform(who, raw);
}

export async function handleVoice(chatId: number, fileId: string) {
  const who = await identify(chatId);
  if (who.role === "guest") {
    await tgSend(chatId, helpText("guest"));
    return;
  }
  const { tgDownloadFile } = await import("./transport.server");
  const file = await tgDownloadFile(fileId);
  if (!file) {
    await tgSend(chatId, "Не смог скачать голосовое, повторите текстом.");
    return;
  }
  try {
    const text = await transcribeVoice(file.base64, file.mime);
    if (!text.trim()) {
      await tgSend(chatId, "Не разобрал голосовое, повторите.");
      return;
    }
    await tgSend(chatId, `🎙 <i>${esc(text)}</i>`);
    await handleFreeform(who, text);
  } catch (e) {
    await tgSend(chatId, `Не смог обработать голос: ${esc(e instanceof Error ? e.message : String(e))}`);
  }
}

/* ---------------------------------- команды ---------------------------------- */

async function handleCommand(who: BotIdentity, raw: string) {
  const [cmdRaw, ...rest] = raw.split(/\s+/);
  const cmd = (cmdRaw ?? "").split("@")[0]?.toLowerCase() ?? "";
  const arg = rest.join(" ").trim();
  const chatId = who.chatId;

  try {
    switch (cmd) {
      case "/start":
      case "/help":
        await tgSend(chatId, helpText(who.role));
        return;
      case "/unlink":
        await unlinkChat(chatId);
        await tgSend(chatId, "Привязка удалена.");
        return;
      case "/mute":
        await setMuted(chatId, new Date(Date.now() + 12 * 3600_000));
        await tgSend(chatId, "🔕 Уведомления приглушены на 12 часов.");
        return;
      case "/unmute":
        await setMuted(chatId, null);
        await tgSend(chatId, "🔔 Уведомления включены.");
        return;
      case "/chatid":
        await tgSend(chatId, `ID этого чата: <code>${chatId}</code>`);
        return;
      case "/setgroup": {
        if (who.role !== "admin") throw new BotForbidden();
        await patchSettings({ group_chat_id: chatId });
        await tgSend(chatId, "✅ Этот чат назначен чатом диджеев: сюда пойдут анонсы и дайджест.");
        return;
      }
      case "/queue":
        await sendQueue(who, Number(arg) || 5);
        return;
      case "/track":
        await sendSearch(who, arg);
        return;
      case "/members":
        await sendMembers(who, (arg || "pending") as DjMemberStatus | "all");
        return;
      case "/stats":
        await sendStats(who, arg);
        return;
      case "/hygiene":
        await sendHygiene(who);
        return;
      case "/pack":
        await sendPack(who, arg);
        return;
      default:
        await tgSend(chatId, "Не знаю такую команду. /help — список.");
    }
  } catch (e) {
    await tgSend(chatId, `⚠️ ${esc(e instanceof Error ? e.message : String(e))}`);
  }
}

async function sendQueue(who: BotIdentity, limit: number) {
  const items = await pendingTracks(who, Math.min(Math.max(limit, 1), 10));
  if (!items.length) {
    await tgSend(who.chatId, "✅ Очередь модерации пуста.");
    return;
  }
  await tgSend(who.chatId, `🕓 <b>На модерации: ${items.length}</b>`);
  for (const t of items) await sendTrackCard(who.chatId, t);
}

export async function sendTrackCard(chatId: number, t: { id: string; status?: string | null } & Record<string, unknown>) {
  const card = trackCard(t as never);
  const buttons = trackButtons(t.id, t.status ?? null);
  const art = await trackArtworkUrl(t.id);
  if (art) await tgSendPhoto(chatId, art, card, buttons);
  else await tgSend(chatId, card, buttons);
}

async function sendSearch(who: BotIdentity, q: string) {
  if (!q) {
    await tgSend(who.chatId, "Что искать? Например: <code>/track kalush</code>");
    return;
  }
  const found = await findTracks(who, q);
  if (!found.length) {
    await tgSend(who.chatId, "Ничего не нашёл.");
    return;
  }
  for (const t of found) await sendTrackCard(who.chatId, t);
}

async function sendMembers(who: BotIdentity, status: DjMemberStatus | "all") {
  const list = await members(who, status);
  if (!list.length) {
    await tgSend(who.chatId, "Нет участников с таким статусом.");
    return;
  }
  if (status === "pending") {
    for (const m of list.slice(0, 10)) await tgSend(who.chatId, memberCard(m), memberButtons(m.id));
    return;
  }
  await tgSend(
    who.chatId,
    `👥 <b>Участники (${MEMBER_STATUS_LABEL[status as DjMemberStatus] ?? "все"}): ${list.length}</b>\n` +
      table(
        ["Ник", "Город", "Статус"],
        list.slice(0, 30).map((m) => [m.nickname, m.city ?? "—", MEMBER_STATUS_LABEL[m.status] ?? m.status]),
      ),
  );
}

function periodDays(arg: string): { days: number; label: string } {
  const a = arg.toLowerCase();
  if (a.startsWith("ден") || a === "день" || a === "day") return { days: 1, label: "сутки" };
  if (a.startsWith("мес") || a === "month") return { days: 30, label: "месяц" };
  return { days: 7, label: "неделя" };
}

async function sendStats(who: BotIdentity, arg: string) {
  const { days, label } = periodDays(arg);
  const s = await stats(who, days);
  const chart = chartUrl(s.topTracks ?? []);
  const text = [
    `📊 <b>Диджей-раздел · ${esc(label)}</b>`,
    ``,
    `⬆️ Загружено: <b>${s.uploads}</b>`,
    `⬇️ Скачано: <b>${s.downloads}</b>`,
    `👥 Новых участников: <b>${s.newMembers}</b>`,
    `🕓 На модерации: <b>${s.pendingTracks}</b> треков, <b>${s.pendingMembers}</b> заявок`,
    ``,
    `<b>Топ по скачиваниям</b>`,
    table(
      ["Трек", "⬇️"],
      (s.topTracks ?? []).slice(0, 10).map((t) => [`${t.artist} — ${t.title}`.slice(0, 34), String(t.download_count ?? 0)]),
    ),
  ].join("\n");
  if (chart) await tgSendPhoto(who.chatId, chart, text);
  else await tgSend(who.chatId, text);
}

/** График топ-треков через QuickChart (как в планере). */
export function chartUrl(top: { artist: string; title: string; download_count: number | null }[]): string | null {
  const items = top.slice(0, 8).filter((t) => (t.download_count ?? 0) > 0);
  if (items.length < 2) return null;
  const config = {
    type: "horizontalBar",
    data: {
      labels: items.map((t) => `${t.artist} — ${t.title}`.slice(0, 28)),
      datasets: [{ label: "Скачивания", data: items.map((t) => t.download_count ?? 0), backgroundColor: "#7c3aed" }],
    },
    options: { legend: { display: false }, title: { display: true, text: "Топ треков" } },
  };
  const url = `https://quickchart.io/chart?w=720&h=420&bkg=white&c=${encodeURIComponent(JSON.stringify(config))}`;
  return url.length > 3800 ? null : url;
}

async function sendHygiene(who: BotIdentity) {
  const items = await dormant(who);
  if (!items.length) {
    await tgSend(who.chatId, "✅ Спящих треков нет: всё скачивают.");
    return;
  }
  await tgSend(
    who.chatId,
    `🧹 <b>Спящие треки: ${items.length}</b>\n(опубликованы давно, ни одного скачивания)\n` +
      table(["Трек", "Раздел"], items.slice(0, 20).map((t) => [trackTitle(t).slice(0, 34), t.section ?? "—"])) +
      `\n\nУдалять по одному: /track &lt;название&gt;`,
  );
}

async function sendPack(who: BotIdentity, name: string) {
  if (!name) {
    await tgSend(who.chatId, "Название пака? Например: <code>/pack свадьба</code>");
    return;
  }
  const found = await packByName(who, name);
  if (!found) {
    await tgSend(who.chatId, "Пак не найден.");
    return;
  }
  const rows = found.items.map((i) => [i.dj_tracks?.artist ?? "—", i.dj_tracks?.title ?? "—"]);
  await tgSend(
    who.chatId,
    [
      `📦 <b>${esc(found.pack.title)}</b>`,
      `Треков: ${found.pack.track_count ?? rows.length}`,
      rows.length ? table(["Артист", "Трек"], rows.slice(0, 30)) : "",
      `<a href="${SITE}/admin/dj">Открыть в админке</a>`,
    ].join("\n"),
  );
}

/* ---------------------------------- кнопки ----------------------------------- */

export async function handleCallback(
  chatId: number,
  callbackId: string,
  data: string,
  messageId?: number,
): Promise<void> {
  const cb = decodeCb(data);
  if (!cb) {
    await tgAnswerCallback(callbackId, "Не понял кнопку");
    return;
  }
  const who = await identify(chatId);
  try {
    if (cb.action === "mem") {
      const m = await setMember(who, cb.id, cb.status);
      await tgAnswerCallback(callbackId, MEMBER_STATUS_LABEL[cb.status] ?? cb.status);
      if (m && messageId) {
        await tgEdit(chatId, messageId, `${memberCard(m)}\n\n<i>Решение сохранено.</i>`);
      }
      await notifyMember(cb.id, cb.status);
      return;
    }
    if (cb.action === "confirm") {
      await tgAnswerCallback(callbackId, "Подтвердите действие");
      if (messageId) {
        const t = await getTrackCard(cb.id);
        if (t) await tgEdit(chatId, messageId, `${trackCard(t)}\n\n❗️ Удалить трек вместе с файлами?`, confirmButtons(cb.op, cb.id));
      }
      return;
    }
    if (cb.action === "trk") {
      if (cb.op === "info") {
        await tgAnswerCallback(callbackId);
        await tgSend(chatId, `<a href="${SITE}/admin/dj/tracks">Открыть в админке</a>`);
        return;
      }
      if (cb.op === "del") {
        await removeTrack(who, cb.id);
        await tgAnswerCallback(callbackId, "Удалено");
        if (messageId) await tgEdit(chatId, messageId, "🗑 Трек удалён.");
        return;
      }
      const status = cb.op === "pub" ? "published" : "rejected";
      const t = await moderate(who, cb.id, status);
      await tgAnswerCallback(callbackId, status === "published" ? "Опубликовано" : "Отклонено");
      if (t && messageId) {
        await tgEdit(
          chatId,
          messageId,
          `${trackCard(t)}\n\n<i>${status === "published" ? "✅ Опубликовано" : "🚫 Отклонено"}</i>`,
        );
      }
      if (t && status === "published") await announceIfEnabled(t);
      return;
    }
    await tgAnswerCallback(callbackId);
  } catch (e) {
    await tgAnswerCallback(callbackId, e instanceof Error ? e.message : "Ошибка");
  }
}

async function announceIfEnabled(t: Parameters<typeof announceCard>[0]) {
  const s = await getSettings();
  if (!s.announce_publications || !s.group_chat_id) return;
  const art = await trackArtworkUrl(t.id);
  if (art) await tgSendPhoto(s.group_chat_id, art, announceCard(t));
  else await tgSend(s.group_chat_id, announceCard(t));
}

/** Уведомление диджея о решении по его заявке. */
async function notifyMember(memberId: string, status: DjMemberStatus) {
  const m = await memberById(memberId);
  if (!m) return;
  const { linksByUser } = await import("./store.server");
  const links = await linksByUser(m.user_id);
  const text =
    status === "approved" || status === "trusted"
      ? `🎉 Ваша заявка одобрена (${MEMBER_STATUS_LABEL[status]}). Заходите в библиотеку: ${SITE}/dj/pool`
      : `Заявка отклонена (${MEMBER_STATUS_LABEL[status] ?? status}).`;
  for (const l of links) await tgSend(l.chat_id, text);
}

/* --------------------------------- ИИ-ответы --------------------------------- */

const TOOLS = [
  {
    type: "function",
    function: {
      name: "queue",
      description: "Показать очередь модерации треков",
      parameters: { type: "object", properties: { limit: { type: "number" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "search_tracks",
      description: "Найти треки по артисту или названию",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "show_members",
      description: "Показать участников диджей-пула",
      parameters: {
        type: "object",
        properties: { status: { type: "string", enum: ["pending", "approved", "trusted", "rejected", "all"] } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_stats",
      description: "Статистика раздела за период",
      parameters: { type: "object", properties: { period: { type: "string", enum: ["день", "неделя", "месяц"] } } },
    },
  },
  {
    type: "function",
    function: {
      name: "show_hygiene",
      description: "Спящий контент библиотеки",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "show_pack",
      description: "Состав пака по названию",
      parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    },
  },
] as const;

const PERSONA = `Ты — ассистент диджей-раздела event-hub.by в Telegram.
Отвечай кратко, по-деловому, на русском. Для любого запроса о треках, участниках,
модерации, статистике, паках и гигиене библиотеки вызывай подходящий инструмент —
не выдумывай данные. Опасные действия (удаление, массовая чистка) не выполняй сам:
предложи открыть карточку трека и подтвердить кнопкой.`;

export async function handleFreeform(who: BotIdentity, text: string) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) {
    await tgSend(who.chatId, "ИИ временно недоступен. Пользуйтесь командами: /help");
    return;
  }
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: PERSONA },
          { role: "user", content: text },
        ],
        tools: TOOLS,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[dj-tg] ai failed [${res.status}]: ${body}`);
      await tgSend(
        who.chatId,
        res.status === 429
          ? "Слишком много запросов к ИИ, попробуйте через минуту."
          : res.status === 402
            ? "Закончились кредиты Lovable AI — пополните баланс в рабочем пространстве."
            : "ИИ не ответил. Пользуйтесь командами: /help",
      );
      return;
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string; tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
    };
    const msg = json.choices?.[0]?.message;
    const call = msg?.tool_calls?.[0]?.function;
    if (call?.name) {
      const args = safeArgs(call.arguments);
      await runTool(who, call.name, args);
      return;
    }
    await tgSend(who.chatId, esc(msg?.content ?? "Не понял запрос. /help — список команд."));
  } catch (e) {
    console.error("[dj-tg] freeform error", e instanceof Error ? e.message : e);
    await tgSend(who.chatId, "Не смог обработать запрос. /help — список команд.");
  }
}

function safeArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function runTool(who: BotIdentity, name: string, args: Record<string, unknown>) {
  try {
    switch (name) {
      case "queue":
        return sendQueue(who, Number(args["limit"]) || 5);
      case "search_tracks":
        return sendSearch(who, String(args["query"] ?? ""));
      case "show_members":
        return sendMembers(who, (args["status"] as DjMemberStatus | "all") ?? "pending");
      case "show_stats":
        return sendStats(who, String(args["period"] ?? "неделя"));
      case "show_hygiene":
        return sendHygiene(who);
      case "show_pack":
        return sendPack(who, String(args["name"] ?? ""));
      default:
        return tgSend(who.chatId, "Не понял запрос. /help — список команд.");
    }
  } catch (e) {
    await tgSend(who.chatId, `⚠️ ${esc(e instanceof Error ? e.message : String(e))}`);
  }
}
