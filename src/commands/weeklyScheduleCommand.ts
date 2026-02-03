import { CommandResult } from "../types";
import {
  getTelegramConfigForMode,
  sendMessage,
  sendMessageToUser,
  sendMessageWithBot,
} from "../services/telegramService";
import { getWeeklySchedule } from "../services/calendarService";
import { formatWeeklyScheduleMessage } from "../utils/weeklyScheduleFormatter";
import { getAppConfig, getTelegramConfig } from "../config/environment";
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

type WeeklyScheduleSendOptions = {
  suppressDebugMessage?: boolean;
  forceDebug?: boolean;
  messageThreadId?: number;
  context?: Record<string, unknown>;
};

export const sendWeeklyScheduleToChat = async (
  chatId: number,
  weekType: "current" | "next",
  options?: WeeklyScheduleSendOptions
): Promise<CommandResult> => {
  const appConfig = getAppConfig();
  const isDebug = options?.forceDebug ? true : appConfig.debug;

  if (isDebug) {
    const debugConfig = getTelegramConfigForMode(true);
    if (!debugConfig.chatId) {
      return { success: false, error: "Debug chat ID not configured" };
    }

    logInfo("DEBUG mode is active, sending weekly schedule to debug chat", {
      targetChatId: debugConfig.chatId,
      weekType,
      ...(options?.context || {}),
    });

    const scheduleInfo = await getWeeklySchedule(weekType);
    const message = formatWeeklyScheduleMessage(scheduleInfo);
    const debugMessage = `🧪 <b>DEBUG</b>\n\n${message}`;
    const debugOptions: Record<string, unknown> = { parse_mode: "HTML" };
    if (debugConfig.topicId) {
      debugOptions.message_thread_id = debugConfig.topicId;
    }

    return await sendMessageWithBot(
      debugConfig.bot,
      debugConfig.chatId,
      debugMessage,
      debugOptions
    );
  }

  const scheduleInfo = await getWeeklySchedule(weekType);
  const message = formatWeeklyScheduleMessage(scheduleInfo);
  const messageOptions: Record<string, unknown> = { parse_mode: "HTML" };
  if (options?.messageThreadId) {
    messageOptions.message_thread_id = options.messageThreadId;
  }
  const result = await sendMessage(chatId, message, messageOptions);

  if (result.success) {
    logInfo("Weekly schedule sent successfully", {
      chatId,
      weekType,
      servicesCount: scheduleInfo?.services.length || 0,
      ...(options?.context || {}),
    });
  } else {
    logWarn("Failed to send weekly schedule", {
      chatId,
      weekType,
      error: result.error,
      ...(options?.context || {}),
    });
  }

  return result;
};

export const sendAdminWeeklySchedule = async (
  weekType: "current" | "next" = "next",
  options?: WeeklyScheduleSendOptions
): Promise<CommandResult> => {
  const appConfig = getAppConfig();
  const telegramConfig = getTelegramConfig();
  const adminUsers = telegramConfig.allowedUsers;

  if (adminUsers.length === 0) {
    logWarn("No allowed users configured for admin weekly schedule", {
      weekType,
      ...(options?.context || {}),
    });
    return { success: false, error: "No administrator configured" };
  }

  const adminUserId = adminUsers[0];

  const isDebug = options?.forceDebug ? true : appConfig.debug;

  if (isDebug) {
    const debugConfig = getTelegramConfigForMode(true);
    if (!debugConfig.chatId) {
      return { success: false, error: "Debug chat ID not configured" };
    }

    logInfo("DEBUG mode is active, sending admin weekly schedule to debug chat", {
      targetChatId: debugConfig.chatId,
      weekType,
      ...(options?.context || {}),
    });

    const scheduleInfo = await getWeeklySchedule(weekType);
    const message = formatWeeklyScheduleMessage(scheduleInfo);
    const adminMessage = `🧪 <b>DEBUG</b>\n\n📝 <b>Предварительное расписание</b>\n\n${message}`;
    const debugOptions: Record<string, unknown> = { parse_mode: "HTML" };
    if (debugConfig.topicId) {
      debugOptions.message_thread_id = debugConfig.topicId;
    }

    return await sendMessageWithBot(
      debugConfig.bot,
      debugConfig.chatId,
      adminMessage,
      debugOptions
    );
  }

  const scheduleInfo = await getWeeklySchedule(weekType);
  const message = formatWeeklyScheduleMessage(scheduleInfo);
  const adminMessage = `📝 <b>Предварительное расписание</b>\n\n${message}`;

  const result = await sendMessageToUser(adminUserId, adminMessage, {
    parse_mode: "HTML",
  });

  if (result.success) {
    logInfo("Admin weekly schedule sent successfully", {
      adminUserId,
      weekType,
      servicesCount: scheduleInfo?.services.length || 0,
      ...(options?.context || {}),
    });
  } else {
    logWarn("Failed to send admin weekly schedule", {
      adminUserId,
      weekType,
      error: result.error,
      ...(options?.context || {}),
    });
  }

  return result;
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
    // If weekType is not provided, show selection menu
    if (!weekType) {
      return await showWeekSelection(chatId);
    }

    return await sendWeeklyScheduleToChat(chatId, weekType, {
      context: { userId },
    });
  } catch (error) {
    logError("Error in weekly schedule command", error);
    return {
      success: false,
      error: "Произошла ошибка при получении недельного расписания",
    };
  }
};
