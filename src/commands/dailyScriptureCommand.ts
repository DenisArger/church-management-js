import { CommandResult } from "../types";
import {
  getTelegramConfigForMode,
  sendMessage,
  sendMessageWithBot,
} from "../services/telegramService";
import { getDailyScripture } from "../services/notionService";
import { getAppConfig, getTelegramConfig } from "../config/environment";
import { formatMoscowDate } from "../utils/dateHelper";
import { logInfo, logWarn, logError } from "../utils/logger";

type DailyScriptureSendOptions = {
  suppressDebugMessage?: boolean;
  forceDebug?: boolean;
  context?: Record<string, unknown>;
};

const INTROS = [
  "📖 <b>День</b> {day}. Чтение Библии на сегодня:",
  "📜 <b>День</b> {day} — время для чтения Слова:",
  "📖 <b>День</b> {day}. Чтение Писания на сегодня:",
  "📖 <b>День</b> {day}. Читаем сегодня:",
  "📖 <b>День</b> {day}. Откроем Слово вместе:",
  "🌅 <b>День</b> {day}. Утреннее чтение Писания:",
  "🙏 <b>День</b> {day}. Пусть Библия говорит сегодня:",
  "📖 <b>День</b> {day}. Размышляем над Писанием:",
  "✨ <b>День</b> {day}. Слово Божье на сегодня:",
  "🔥 <b>День</b> {day}. Сегодняшнее чтения:",
];

const CLOSINGS = [
  "Благословений и хорошего дня!🙏",
  "Пусть Слово укрепит вас сегодня!🙏",
  "Хорошего дня и мира вам!✝️",
  "Да будет этот день наполнен благодатью и радостью!🙏",
  "Мира вам и радости во Христе!🙏",
  "Пусть Господь благословит ваш день!🙏",
  "С благодарностью за Его Слово!🙏",
  "Да сопровождает вас Божья милость!🙏",
  "Хорошего чтения и благословенного дня!🌅",
  "Пребывайте в любви и истине!🙏",
];

// Deterministic seed from the Moscow calendar day, so the same day always
// produces the same variant (stable across the 15-minute scheduler window).
const dayHash = (date: Date): number => {
  const s = formatMoscowDate(date);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  }
  return h;
};

export const formatDailyScriptureMessage = (
  scripture: {
    dayNumber: number | null;
    oldTestament: string;
    newTestament: string;
  },
  date: Date = new Date(),
): string => {
  const seed = dayHash(date);
  const dayLabel =
    scripture.dayNumber !== null ? String(scripture.dayNumber) : "нет данных";
  const oldLabel = scripture.oldTestament || "нет данных";
  const newLabel = scripture.newTestament || "нет данных";

  const intro = INTROS[seed % INTROS.length].replace("{day}", dayLabel);

  const otBlock = `📜 <b>Ветхий Завет:</b> ${oldLabel}`;
  const ntBlock = `📜 <b>Новый Завет:</b> ${newLabel}`;
  // Rotate the order of the two testament blocks by day.
  const body =
    seed % 2 === 0 ? `${otBlock}\n${ntBlock}` : `${ntBlock}\n${otBlock}`;

  const closing = CLOSINGS[(seed >> 4) % CLOSINGS.length];

  return `${intro}\n\n${body}\n\n${closing}`;
};

export const sendDailyScripture = async (
  options?: DailyScriptureSendOptions,
): Promise<CommandResult> => {
  const appConfig = getAppConfig();
  const isDebug = options?.forceDebug ? true : appConfig.debug;

  if (isDebug) {
    const debugConfig = getTelegramConfigForMode(true);
    if (!debugConfig.chatId) {
      return { success: false, error: "Debug chat ID not configured" };
    }

    const scripture = await getDailyScripture();
    if (!scripture) {
      logInfo("DEBUG: no daily scripture found, skipping", {
        ...(options?.context || {}),
      });
      return { success: true, message: "No daily scripture for today (DEBUG)" };
    }

    const message = `🧪 <b>DEBUG</b>\n\n${formatDailyScriptureMessage(scripture, new Date())}`;
    const debugOptions: Record<string, unknown> = { parse_mode: "HTML" };
    if (debugConfig.topicId) {
      debugOptions.message_thread_id = debugConfig.topicId;
    }

    logInfo("DEBUG mode is active, sending daily scripture to debug chat", {
      targetChatId: debugConfig.chatId,
      ...(options?.context || {}),
    });

    return await sendMessageWithBot(
      debugConfig.bot,
      debugConfig.chatId,
      message,
      debugOptions,
    );
  }

  const telegramConfig = getTelegramConfig();
  const rawMainGroupId = telegramConfig.mainGroupId;
  const rawTopicId = telegramConfig.readBibleTopicId;

  const mainGroupId =
    rawMainGroupId && rawMainGroupId.trim().length > 0
      ? parseInt(rawMainGroupId.trim(), 10)
      : NaN;
  const topicId =
    rawTopicId && rawTopicId.trim().length > 0
      ? parseInt(rawTopicId.trim(), 10)
      : NaN;

  if (isNaN(mainGroupId)) {
    logWarn("Daily scripture skipped: TELEGRAM_MAIN_GROUP_ID not set", {
      ...(options?.context || {}),
    });
    return { success: false, error: "Main group ID not configured" };
  }

  const scripture = await getDailyScripture();
  if (!scripture) {
    logInfo("No daily scripture found for today, skipping broadcast", {
      ...(options?.context || {}),
    });
    return { success: true, message: "No daily scripture for today" };
  }

  const message = formatDailyScriptureMessage(scripture, new Date());
  const messageOptions: Record<string, unknown> = { parse_mode: "HTML" };
  if (!isNaN(topicId)) {
    messageOptions.message_thread_id = topicId;
  }

  const result = await sendMessage(mainGroupId, message, messageOptions);

  if (result.success) {
    logInfo("Daily scripture sent successfully", {
      chatId: mainGroupId,
      topicId: !isNaN(topicId) ? topicId : undefined,
      dayNumber: scripture.dayNumber,
      ...(options?.context || {}),
    });
  } else {
    logError("Failed to send daily scripture", {
      chatId: mainGroupId,
      error: result.error,
      ...(options?.context || {}),
    });
  }

  return result;
};
