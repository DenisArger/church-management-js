import { CommandResult } from "../types";
import { sendMessageToUser, getTelegramConfigForMode } from "../services/telegramService";
import { getAppConfig } from "../config/environment";
import { logInfo, logError } from "../utils/logger";
import { formatDateTimeMoscow } from "../utils/dateHelper";
import { getYouthEventsForDateRange } from "../services/notionService";
import { executeAutoPollForEvent } from "./autoPollCommand";

/**
 * Get the nearest upcoming event (today or tomorrow)
 */
const getNearestEvent = async () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  const events = await getYouthEventsForDateRange(now, tomorrow, [
    "Молодежное",
    "МОСТ",
  ]);

  if (events.length === 0) {
    return null;
  }

  // Sort by date and return the nearest one
  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  return events[0];
};

/**
 * Execute create poll command
 * Now uses automatic poll generation based on nearest event from calendar
 */
export const executeCreatePollCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult> => {
  logInfo("Executing create poll command", { userId, chatId });

  try {
    // Get nearest event (today or tomorrow)
    const event = await getNearestEvent();

    if (!event) {
      // No event found, send message to user
      const message =
        "Нет запланированных молодежных мероприятий на сегодня или завтра.\n\n" +
        "Проверьте календарь в Notion или создайте событие.";

      const result = await sendMessageToUser(userId, message);

      if (result.success) {
        return {
          success: true,
          message: "Message sent to user about no events",
        };
      } else {
        logError("Failed to send message to user", result.error);
        return {
          success: false,
          error: "Не удалось отправить сообщение пользователю",
        };
      }
    }

    logInfo("Found nearest event for poll", {
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.date.toISOString(),
      serviceType: event.serviceType,
    });

    // Check if we should use chatId from parameters (for testing)
    // If configured chat ID is not set, use parameter chatId as fallback for testing
    const appConfig = getAppConfig();
    const telegramConfig = getTelegramConfigForMode(appConfig.debug);
    const useChatId = !telegramConfig.chatId ? chatId : undefined;
    const isTestingMode = !!useChatId;

    // Use the auto poll command to create poll with proper content
    const result = await executeAutoPollForEvent(event, useChatId);

    if (result.success) {
      // Also send confirmation to user
      let userMessage = `✅ Опрос создан!\n\n`;
      
      if (isTestingMode) {
        userMessage += `⚠️ Режим тестирования: опрос отправлен в этот чат.\n`;
        userMessage += `Для продакшена настройте TELEGRAM_YOUTH_GROUP_ID в .env\n\n`;
      }
      
      userMessage += `Событие: ${event.title}\n`;
      userMessage += `Дата: ${formatDateTimeMoscow(event.date)}\n`;
      if (event.theme) {
        userMessage += `Тема: "${event.theme}"`;
      }

      await sendMessageToUser(userId, userMessage);
    } else {
      // Send error message to user
      await sendMessageToUser(
        userId,
        `❌ Не удалось создать опрос: ${result.error || "Неизвестная ошибка"}\n\n` +
        `Убедитесь, что настроен TELEGRAM_YOUTH_GROUP_ID в .env`
      );
    }

    return result;
  } catch (error) {
    logError("Error in create poll command", error);
    return {
      success: false,
      error: "Произошла ошибка при создании опроса",
    };
  }
};
