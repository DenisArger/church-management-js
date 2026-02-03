import { CommandResult } from "../types";
import { getAppConfig, getTelegramConfig } from "../config/environment";
import {
  getTelegramConfigForMode,
  sendMessageToUser,
  sendMessageWithBot,
} from "../services/telegramService";
import { getRandomYouthCareReminder } from "../utils/youthCareReminderGenerator";
import { logInfo, logWarn, logError } from "../utils/logger";

type ReminderSendOptions = {
  suppressDebugMessage?: boolean;
  forceDebug?: boolean;
  context?: Record<string, unknown>;
};

export const sendYouthCareReminderToAdmins = async (
  options?: ReminderSendOptions
): Promise<CommandResult> => {
  const appConfig = getAppConfig();
  const telegramConfig = getTelegramConfig();
  const adminUsers = telegramConfig.allowedUsers;

  if (adminUsers.length === 0) {
    logWarn("No allowed users configured for youth care reminder", {
      ...(options?.context || {}),
    });
    return { success: false, error: "No administrator configured" };
  }

  const isDebug = options?.forceDebug ? true : appConfig.debug;
  const reminderText = getRandomYouthCareReminder();

  if (isDebug) {
    const debugConfig = getTelegramConfigForMode(true);
    if (!debugConfig.chatId) {
      return { success: false, error: "Debug chat ID not configured" };
    }

    logInfo("DEBUG mode is active, sending youth care reminder to debug chat", {
      targetChatId: debugConfig.chatId,
      ...(options?.context || {}),
    });

    const debugMessage = `🧪 <b>DEBUG</b>\n\n${reminderText}`;
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

  let successCount = 0;
  let lastError: string | undefined;

  for (const adminUserId of adminUsers) {
    const result = await sendMessageToUser(adminUserId, reminderText, {
      parse_mode: "HTML",
    });
    if (result.success) {
      successCount++;
    } else {
      lastError = result.error;
      logWarn("Failed to send youth care reminder to admin", {
        adminUserId,
        error: result.error,
        ...(options?.context || {}),
      });
    }
  }

  if (successCount > 0) {
    logInfo("Youth care reminders sent", {
      successCount,
      total: adminUsers.length,
      ...(options?.context || {}),
    });
    return { success: true, message: "Youth care reminders sent" };
  }

  logError("Failed to send youth care reminders to all admins", {
    lastError,
    ...(options?.context || {}),
  });

  return {
    success: false,
    error: lastError || "Failed to send youth care reminders",
  };
};
