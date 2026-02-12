import { CommandResult } from "../types";
import { getAppConfig } from "../config/environment";
import {
  getTelegramConfigForMode,
  sendMessageToUser,
  sendMessageWithBot,
} from "../services/telegramService";
import { getRandomYouthReportReminder } from "../utils/youthReportReminderGenerator";
import { logInfo, logWarn, logError } from "../utils/logger";
import { getYouthLeadersMapping } from "../services/notionService";

type ReminderSendOptions = {
  suppressDebugMessage?: boolean;
  forceDebug?: boolean;
  context?: Record<string, unknown>;
};

export const sendYouthReportReminderToAdmins = async (
  options?: ReminderSendOptions
): Promise<CommandResult> => {
  const appConfig = getAppConfig();
  const youthLeaders = await getYouthLeadersMapping();
  const adminUsers = Array.from(youthLeaders.keys());

  if (adminUsers.length === 0) {
    logWarn("No active youth leaders configured for youth report reminder", {
      ...(options?.context || {}),
    });
    return { success: false, error: "No active youth leaders configured" };
  }

  const isDebug = options?.forceDebug ? true : appConfig.debug;
  const reminderText = getRandomYouthReportReminder();

  if (isDebug) {
    const debugConfig = getTelegramConfigForMode(true);
    if (!debugConfig.chatId) {
      return { success: false, error: "Debug chat ID not configured" };
    }

    logInfo("DEBUG mode is active, sending youth report reminder to debug chat", {
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
      logWarn("Failed to send youth report reminder to admin", {
        adminUserId,
        error: result.error,
        ...(options?.context || {}),
      });
    }
  }

  if (successCount > 0) {
    logInfo("Youth report reminders sent", {
      successCount,
      total: adminUsers.length,
      ...(options?.context || {}),
    });
    return { success: true, message: "Youth report reminders sent" };
  }

  logError("Failed to send youth report reminders to all admins", {
    lastError,
    ...(options?.context || {}),
  });

  return {
    success: false,
    error: lastError || "Failed to send youth report reminders",
  };
};
