import { CommandResult, CalendarItem } from "../types";
import {
  sendPoll,
  getTelegramConfigForMode,
  sendMessageToUser,
} from "../services/telegramService";
import { getAppConfig, getTelegramConfig } from "../config/environment";
import { logInfo, logError, logWarn } from "../utils/logger";
import { generatePollContent } from "../utils/pollTextGenerator";
import {
  isEventMissing,
  hasTheme,
  hasTime,
} from "../utils/pollScheduler";
import { formatDateTimeMoscow } from "../utils/dateHelper";

/**
 * Send poll notification to administrator
 */
export const sendPollNotification = async (
  event: CalendarItem | null,
  eventDate: Date
): Promise<CommandResult> => {
  try {
    const telegramConfig = getTelegramConfig();
    
    // Get first allowed user as administrator (or use a specific admin ID if configured)
    const adminUsers = telegramConfig.allowedUsers;
    if (adminUsers.length === 0) {
      logWarn("No allowed users configured for notifications");
      return {
        success: false,
        error: "No administrator configured",
      };
    }
    
    const adminUserId = adminUsers[0];
    
    let message: string;
    
    if (isEventMissing(event)) {
      message = `⚠️ Внимание! Запланирована рассылка опроса, но событие отсутствует в календаре.\n\n`;
      message += `Дата события: ${formatDateTimeMoscow(eventDate)}\n\n`;
      message += `Пожалуйста, проверьте календарь и создайте событие, если оно должно быть.`;
    } else if (event) {
      const eventHasTheme = hasTheme(event);
      const resolvedTheme = event.theme?.trim() || event.title?.trim() || "";
      const eventHasTime = hasTime(event);
      const issues: string[] = [];
      
      if (!eventHasTheme) {
        issues.push("отсутствует тема");
      }
      if (!eventHasTime) {
        issues.push("не установлено время");
      }
      
      if (issues.length > 0) {
        message = `⚠️ Внимание! Запланирована рассылка опроса, но у события ${issues.join(" и ")}.\n\n`;
        message += `Тип служения: ${event.serviceType || event.title}\n`;
        message += `Дата: ${formatDateTimeMoscow(event.date)}\n`;
        if (eventHasTheme && resolvedTheme) {
          message += `Тема: "${resolvedTheme}"\n`;
        }
        message += `\n`;
        
        if (!eventHasTheme && !eventHasTime) {
          message += `Опрос будет отправлен без темы и с дефолтным временем (19:00). Пожалуйста, проверьте необходимость добавления темы и установки времени.`;
        } else if (!eventHasTheme) {
          message += `Опрос будет отправлен без темы. Пожалуйста, проверьте необходимость добавления темы.`;
        } else if (!eventHasTime) {
          message += `Опрос будет отправлен с дефолтным временем (19:00). Пожалуйста, проверьте необходимость установки времени.`;
        }
      } else {
        message = `📋 Напоминание: через 3 часа будет отправлен опрос о предстоящем событии.\n\n`;
        message += `Тип служения: ${event.serviceType || event.title}\n`;
        message += `Дата: ${formatDateTimeMoscow(event.date)}\n`;
        message += `Тема: "${resolvedTheme}"\n\n`;
        message += `Пожалуйста, проверьте необходимость отправки опроса и наличие темы.`;
      }
    } else {
      // Fallback case (should not happen, but TypeScript requires it)
      message = `⚠️ Внимание! Запланирована рассылка опроса, но событие отсутствует в календаре.\n\n`;
      message += `Дата события: ${formatDateTimeMoscow(eventDate)}\n\n`;
      message += `Пожалуйста, проверьте календарь и создайте событие, если оно должно быть.`;
    }
    
    const result = await sendMessageToUser(adminUserId, message);
    
    if (result.success) {
      logInfo("Poll notification sent to administrator", {
        adminUserId,
        eventId: event?.id,
        hasEvent: !!event,
        hasTheme: hasTheme(event),
        hasTime: hasTime(event),
      });
    } else {
      logError("Failed to send poll notification", result.error);
    }
    
    return result;
  } catch (error) {
    logError("Error sending poll notification", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Send poll failure notification to administrator
 * @param event - The calendar event that failed
 * @param errorMessage - Error message from the failure
 * @param context - Additional context information (chatId, topicId, debug mode, etc.)
 */
export const sendPollFailureNotification = async (
  event: CalendarItem,
  errorMessage: string,
  context: {
    chatId?: number | null;
    topicId?: number;
    debugMode?: boolean;
    timestamp?: Date;
    additionalInfo?: string;
  }
): Promise<void> => {
  try {
    const telegramConfig = getTelegramConfig();
    
    // Get first allowed user as administrator
    const adminUsers = telegramConfig.allowedUsers;
    if (adminUsers.length === 0) {
      logWarn("No allowed users configured for failure notifications");
      return;
    }
    
    const adminUserId = adminUsers[0];
    const timestamp = context.timestamp || new Date();
    
    // Build detailed error message
    let message = `❌ ОШИБКА: Не удалось отправить опрос\n\n`;
    message += `Тип служения: ${event.serviceType || event.title}\n`;
    message += `Дата: ${formatDateTimeMoscow(event.date)}\n`;
    message += `ID события: ${event.id}\n\n`;
    message += `Ошибка: ${errorMessage}\n\n`;
    message += `Контекст:\n`;
    message += `- Chat ID: ${context.chatId || "не установлен"}\n`;
    message += `- Topic ID: ${context.topicId || "не установлен"}\n`;
    message += `- Режим: ${context.debugMode ? "debug" : "production"}\n`;
    message += `- Время попытки: ${timestamp.toLocaleString("ru-RU")}\n`;
    
    if (context.additionalInfo) {
      message += `\nДополнительная информация: ${context.additionalInfo}`;
    }
    
    message += `\n\nПожалуйста, проверьте:\n`;
    message += `1. Настройки бота и чата\n`;
    message += `2. Права бота в группе\n`;
    message += `3. Логи для дополнительной информации`;
    
    const result = await sendMessageToUser(adminUserId, message);
    
    if (result.success) {
      logInfo("Poll failure notification sent to administrator", {
        adminUserId,
        eventId: event.id,
        eventTitle: event.title,
      });
    } else {
      // Don't try to send notification about notification failure - just log it
      logError("Failed to send poll failure notification to administrator", {
        adminUserId,
        error: result.error,
        originalEventId: event.id,
      });
    }
  } catch (error) {
    // Don't try to send notification about notification failure - just log it
    logError("Error sending poll failure notification", {
      error: error instanceof Error ? error.message : "Unknown error",
      eventId: event.id,
    });
  }
};

/**
 * Execute auto poll for a specific event
 * @param event - The calendar event to create poll for
 * @param overrideChatId - Optional chat ID to override configured chat ID (for manual testing)
 */
export const executeAutoPollForEvent = async (
  event: CalendarItem,
  overrideChatId?: number
): Promise<CommandResult> => {
  logInfo("Executing auto poll for event", {
    eventId: event.id,
    eventTitle: event.title,
    eventDate: event.date.toISOString(),
    overrideChatId,
  });

  try {
    const appConfig = getAppConfig();

    // Generate poll content
    const { question, options } = generatePollContent(event);

    logInfo("Generated poll content", {
      eventTitle: event.title,
      question,
      options,
      debugMode: appConfig.debug,
    });

    // Get appropriate configuration based on debug mode
    const telegramConfig = getTelegramConfigForMode(appConfig.debug);

    // Use override chat ID if provided, otherwise use configured chat ID
    const chatId = overrideChatId || telegramConfig.chatId;

    if (!chatId) {
      logError("No chat ID configured for auto poll");
      return {
        success: false,
        error: "Не настроен ID чата для молодежной группы",
      };
    }

    // Send the poll
    const result = await sendPoll(
      telegramConfig.bot,
      chatId,
      question,
      options,
      telegramConfig.topicId
    );

    if (result.success) {
      logInfo("Auto poll created successfully", {
        chatId: chatId,
        topicId: telegramConfig.topicId,
        pollId: result.data?.pollId,
        debugMode: appConfig.debug,
        eventTitle: event.title,
      });

      return {
        success: true,
        message: `Auto poll created! Event: "${event.title}"`,
        data: result.data,
      };
    } else {
      logError("Failed to create auto poll", { error: result.error });
      
      // Notify administrator about the failure
      await sendPollFailureNotification(
        event,
        result.error || "Неизвестная ошибка при отправке опроса",
        {
          chatId: chatId,
          topicId: telegramConfig.topicId,
          debugMode: appConfig.debug,
          timestamp: new Date(),
          additionalInfo: `Вопрос опроса: "${question}"`,
        }
      );
      
      return {
        success: false,
        error: "Не удалось создать опрос",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
    logError("Error in auto poll command", error);
    
    // Notify administrator about the critical error
    // This covers errors that occur before sendPoll (e.g., content generation, configuration)
    try {
      const appConfig = getAppConfig();
      const telegramConfig = getTelegramConfigForMode(appConfig.debug);
      const chatId = overrideChatId || telegramConfig.chatId;
      
      await sendPollFailureNotification(
        event,
        `Критическая ошибка: ${errorMessage}`,
        {
          chatId: chatId,
          topicId: telegramConfig.topicId,
          debugMode: appConfig.debug,
          timestamp: new Date(),
          additionalInfo: "Ошибка произошла до попытки отправки опроса (возможно, проблема с генерацией контента или конфигурацией)",
        }
      );
    } catch (notificationError) {
      // Don't throw - we've already logged the original error
      logError("Failed to send failure notification for critical error", notificationError);
    }
    
    return {
      success: false,
      error: "Произошла ошибка при создании автоматического опроса",
    };
  }
};


