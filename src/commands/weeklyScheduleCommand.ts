import { CommandResult } from "../types";
import { sendMessage } from "../services/telegramService";
import { getWeeklySchedule } from "../services/calendarService";
import { formatWeeklyScheduleMessage } from "../utils/weeklyScheduleFormatter";
import { getAppConfig } from "../config/environment";
import { logInfo, logWarn, logError } from "../utils/logger";

/**
 * Execute /weekly_schedule command
 * Gets and sends weekly schedule of services that need mailing
 */
export const executeWeeklyScheduleCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult> => {
  logInfo("Executing weekly schedule command", { userId, chatId });

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

    // Get weekly schedule information
    const scheduleInfo = await getWeeklySchedule();

    // Format and send the message
    const message = formatWeeklyScheduleMessage(scheduleInfo);
    const result = await sendMessage(chatId, message, { parse_mode: "HTML" });

    if (result.success) {
      logInfo("Weekly schedule sent successfully", {
        userId,
        chatId,
        servicesCount: scheduleInfo?.services.length || 0,
      });
    } else {
      logWarn("Failed to send weekly schedule", {
        userId,
        chatId,
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
