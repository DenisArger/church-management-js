import { CommandResult } from "../types";
import { getTelegramConfigForMode, sendMessage } from "../services/telegramService";
import { getWeeklySchedule } from "../services/calendar/weeklySchedule";
import { formatWeeklyScheduleMessage } from "../utils/weeklyScheduleFormatter";
import { getAppConfig, getTelegramConfig } from "../config/environment";
import { logInfo, logError } from "../utils/logger";

/**
 * Execute copy weekly schedule command
 * Returns schedule formatted as plain text for easy copying
 * @param userId - Telegram user ID
 * @param chatId - Telegram chat ID
 * @param weekType - "current" for current week, "next" for next week
 */
export const executeCopyWeeklyScheduleCommand = async (
  userId: number,
  chatId: number,
  weekType: "current" | "next" = "current"
): Promise<CommandResult> => {
  logInfo("Executing copy weekly schedule command", { userId, chatId, weekType });

  try {
    const scheduleInfo = await getWeeklySchedule(weekType);

    if (!scheduleInfo || scheduleInfo.services.length === 0) {
      const weekLabel = weekType === "current" ? "текущей" : "следующей";
      return await sendMessage(chatId, `📭 В ${weekLabel} неделе нет служений для рассылки.`, {
        parse_mode: "HTML",
      });
    }

    const message = formatWeeklyScheduleMessage(scheduleInfo);
    // Strip HTML tags for plain text copy
    const plainText = message
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/&/g, "&")
      .trim();

    const weekLabel = weekType === "current" ? "текущей" : "следующей";
    const copyMessage = `📋 <b>Расписание на ${weekLabel} неделю (для копирования):</b>\n\n<code>${plainText}</code>\n\n<i>Долгим нажатием на текст выше можно скопировать его целиком.</i>`;

    return await sendMessage(chatId, copyMessage, { parse_mode: "HTML" });
  } catch (error) {
    logError("Error copying weekly schedule", error);
    return { success: false, error: "Произошла ошибка при получении расписания" };
  }
};