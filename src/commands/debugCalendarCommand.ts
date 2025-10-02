import { CommandResult } from "../types";
import { sendMessage } from "../services/telegramService";
import { debugCalendarDatabase } from "../services/calendarService";
import { logInfo, logError } from "../utils/logger";

/**
 * Execute debug calendar command
 * Shows all records in the calendar database for debugging
 */
export const executeDebugCalendarCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult> => {
  logInfo("Executing debug calendar command", { userId, chatId });

  try {
    await debugCalendarDatabase();

    return await sendMessage(
      chatId,
      "Отладочная информация о базе календаря отправлена в логи. Проверьте консоль."
    );
  } catch (error) {
    logError("Error in debug calendar command", error);
    return {
      success: false,
      error: "Произошла ошибка при получении отладочной информации",
    };
  }
};
