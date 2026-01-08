import { CommandResult } from "../types";
import { sendMessage } from "../services/telegramService";
import { getWeeklySchedule } from "../services/calendarService";
import { formatWeeklyScheduleMessage } from "../utils/weeklyScheduleFormatter";
import { getAppConfig } from "../config/environment";
import { logInfo, logWarn, logError } from "../utils/logger";

/**
 * Show week selection keyboard
 */
export const showWeekSelection = async (
  chatId: number
): Promise<CommandResult> => {
  const keyboard = {
    inline_keyboard: [
      [
        { text: "📅 Текущая неделя", callback_data: "cmd:weekly_schedule:current" },
        { text: "📅 Следующая неделя", callback_data: "cmd:weekly_schedule:next" },
      ],
    ],
  };

  return await sendMessage(
    chatId,
    "📆 <b>Выберите неделю для рассылки расписания:</b>",
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }
  );
};

/**
 * Execute /weekly_schedule command
 * Gets and sends weekly schedule of services that need mailing
 * @param weekType - Optional week type: "current" or "next". If not provided, shows selection menu.
 */
export const executeWeeklyScheduleCommand = async (
  userId: number,
  chatId: number,
  weekType?: "current" | "next"
): Promise<CommandResult> => {
  logInfo("Executing weekly schedule command", { userId, chatId, weekType });

  try {
    const appConfig = getAppConfig();

    // Check if debug mode is active
    if (appConfig.debug) {
      logInfo("DEBUG mode is active, sending debug message");
      return await sendMessage(
        chatId,
        "DEBUG-режим активен, рассылка недельного расписания не будет отправлена"
      );
    }

    // If weekType is not provided, show selection menu
    if (!weekType) {
      return await showWeekSelection(chatId);
    }

    // Get weekly schedule information for selected week
    const scheduleInfo = await getWeeklySchedule(weekType);

    // Format and send the message
    const message = formatWeeklyScheduleMessage(scheduleInfo);
    const result = await sendMessage(chatId, message, { parse_mode: "HTML" });

    if (result.success) {
      logInfo("Weekly schedule sent successfully", {
        userId,
        chatId,
        weekType,
        servicesCount: scheduleInfo?.services.length || 0,
      });
    } else {
      logWarn("Failed to send weekly schedule", {
        userId,
        chatId,
        weekType,
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    logError("Error in weekly schedule command", error);
    return {
      success: false,
      error: "Произошла ошибка при получении недельного расписания",
    };
  }
};
