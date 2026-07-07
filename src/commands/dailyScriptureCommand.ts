import { CommandResult } from "../types";
import {
  getTelegramConfigForMode,
  sendMessage,
  sendMessageWithBot,
} from "../services/telegramService";
import { getDailyScripture } from "../services/notionService";
import { getAppConfig, getTelegramConfig } from "../config/environment";
import { logInfo, logWarn, logError } from "../utils/logger";

type DailyScriptureSendOptions = {
  suppressDebugMessage?: boolean;
  forceDebug?: boolean;
  context?: Record<string, unknown>;
};

const formatDailyScriptureMessage = (scripture: {
  dayNumber: number | null;
  oldTestament: string;
  newTestament: string;
}): string => {
  const dayLabel = scripture.dayNumber !== null ? String(scripture.dayNumber) : "нет данных";
  const oldLabel = scripture.oldTestament || "нет данных";
  const newLabel = scripture.newTestament || "нет данных";

  return (
    `📖 <b>День</b> ${dayLabel}. Чтение Библии на сегодня:\n\n` +
    `📜 <b>Ветхий Завет:</b> ${oldLabel}\n` +
    `📜 <b>Новый Завет:</b> ${newLabel}\n\n` +
    `Благословений и хорошего дня!🙏`
  );
};

export const sendDailyScripture = async (
  options?: DailyScriptureSendOptions
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

    const message = `🧪 <b>DEBUG</b>\n\n${formatDailyScriptureMessage(scripture)}`;
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
      debugOptions
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

  const message = formatDailyScriptureMessage(scripture);
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
