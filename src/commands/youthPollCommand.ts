import { CommandResult } from "../types";
import {
  sendPoll,
  getTelegramConfigForMode,
  sendMessageToUser,
} from "../services/telegramService";
import { getYouthEventForTomorrow } from "../services/notionService";
import { getAppConfig } from "../config/environment";
import { logInfo, logError } from "../utils/logger";

/**
 * Extract time and theme from youth event
 */
export const extractEventDetails = (event: {
  title?: string;
  description?: string;
  theme?: string;
  date?: Date;
}): { time: string; theme: string } => {
  const title = event.title || "";
  const description = event.description || "";
  const themeFromNotion = event.theme || "";
  const eventDate = event.date;

  // Extract time from event date
  let time = "19:00"; // Default time

  if (eventDate) {
    // Format time as HH:MM
    const hours = eventDate.getHours().toString().padStart(2, "0");
    const minutes = eventDate.getMinutes().toString().padStart(2, "0");
    time = `${hours}:${minutes}`;

    logInfo("Extracted time from event date", {
      date: eventDate.toISOString(),
      time,
    });
  } else {
    logInfo("No event date provided, using default time", {
      defaultTime: time,
    });
  }

  // Theme is the full title (Название служения)
  const theme = title.trim();

  // Debug logging
  logInfo("Extracting event details", {
    title,
    description,
    themeFromNotion,
    theme: theme,
  });

  if (theme) {
    logInfo("Using full title as theme", { theme });
  } else {
    logInfo("Title is empty, will create poll without theme");
  }

  return { time, theme };
};

/**
 * Execute /youth_poll command
 * Creates a poll for youth service attendance if there's an event tomorrow
 */
export const executeYouthPollCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult> => {
  logInfo("Executing youth poll command", { userId, chatId });

  try {
    const appConfig = getAppConfig();

    // Get youth event for tomorrow
    logInfo("Querying Notion for youth events tomorrow", { userId, chatId });
    const youthEvent = await getYouthEventForTomorrow();

    if (!youthEvent) {
      logInfo(
        "No youth event found for tomorrow - this explains why default theme is used"
      );

      // Send message to user's private chat instead of group chat
      const messageResult = await sendMessageToUser(
        userId,
        "Нет молодежного мероприятия на завтра"
      );

      if (messageResult.success) {
        return {
          success: true,
          message: "Message sent to user",
        };
      } else {
        logError("Failed to send message to user", messageResult.error);
        return {
          success: false,
          error: "Не удалось отправить сообщение пользователю",
        };
      }
    }

    // Extract event details
    logInfo("Extracting details from youth event", {
      eventId: youthEvent.id,
      eventTitle: youthEvent.title,
      eventDescription: youthEvent.description,
      eventTheme: youthEvent.theme,
      eventType: youthEvent.type,
    });

    const { time, theme } = extractEventDetails(youthEvent);

    // Form the poll question
    const question = theme
      ? `Молодежное завтра в ${time}. Тема: "${theme}". Придешь?`
      : `Молодежное завтра в ${time}. Придешь?`;
    const options = ["Конечно, буду.", "К сожалению, не буду."];

    logInfo("Creating youth poll", {
      eventTitle: youthEvent.title,
      extractedTime: time,
      extractedTheme: theme,
      finalQuestion: question,
      debugMode: appConfig.debug,
    });

    // Get appropriate configuration based on debug mode
    const telegramConfig = getTelegramConfigForMode(appConfig.debug);

    if (!telegramConfig.chatId) {
      logError("No chat ID configured for youth poll");
      return {
        success: false,
        error: "Не настроен ID чата для молодежной группы",
      };
    }

    // Send the poll
    const result = await sendPoll(
      telegramConfig.bot,
      telegramConfig.chatId,
      question,
      options,
      telegramConfig.topicId
    );

    if (result.success) {
      logInfo("Youth poll created successfully", {
        userId,
        chatId: telegramConfig.chatId,
        topicId: telegramConfig.topicId,
        pollId: result.data?.pollId,
        debugMode: appConfig.debug,
      });

      return {
        success: true,
        message: `Опрос о молодежном служении создан! Тема: "${theme}"`,
        data: result.data,
      };
    } else {
      logError("Failed to create youth poll", { error: result.error });
      return {
        success: false,
        error: "Не удалось создать опрос",
      };
    }
  } catch (error) {
    logError("Error in youth poll command", error);
    return {
      success: false,
      error: "Произошла ошибка при создании опроса о молодежном служении",
    };
  }
};

/**
 * Execute youth poll for scheduled automation
 * This version uses debug mode if configured
 */
export const executeYouthPollScheduled = async (): Promise<CommandResult> => {
  logInfo("Executing scheduled youth poll");

  try {
    const appConfig = getAppConfig();

    // Get youth event for tomorrow
    const youthEvent = await getYouthEventForTomorrow();

    if (!youthEvent) {
      logInfo("No youth event found for tomorrow - skipping scheduled poll");
      return {
        success: true,
        message: "No youth event tomorrow - poll not created",
      };
    }

    // Extract event details
    const { time, theme } = extractEventDetails(youthEvent);

    // Form the poll question
    const question = theme
      ? `Молодежное завтра в ${time}. Тема: "${theme}". Придешь?`
      : `Молодежное завтра в ${time}. Придешь?`;
    const options = ["Конечно, буду.", "К сожалению, не буду."];

    logInfo("Creating scheduled youth poll", {
      eventTitle: youthEvent.title,
      time,
      theme,
      question,
      debugMode: appConfig.debug,
    });

    // Get appropriate configuration based on debug mode
    const telegramConfig = getTelegramConfigForMode(appConfig.debug);

    if (!telegramConfig.chatId) {
      logError("No chat ID configured for scheduled youth poll");
      return {
        success: false,
        error: "Не настроен ID чата для молодежной группы",
      };
    }

    // Send the poll
    const result = await sendPoll(
      telegramConfig.bot,
      telegramConfig.chatId,
      question,
      options,
      telegramConfig.topicId
    );

    if (result.success) {
      logInfo("Scheduled youth poll created successfully", {
        chatId: telegramConfig.chatId,
        topicId: telegramConfig.topicId,
        pollId: result.data?.pollId,
        debugMode: appConfig.debug,
      });

      return {
        success: true,
        message: `Scheduled youth poll created! Theme: "${theme}"`,
        data: result.data,
      };
    } else {
      logError("Failed to create scheduled youth poll", {
        error: result.error,
      });
      return {
        success: false,
        error: "Не удалось создать запланированный опрос",
      };
    }
  } catch (error) {
    logError("Error in scheduled youth poll", error);
    return {
      success: false,
      error: "Произошла ошибка при создании запланированного опроса",
    };
  }
};
