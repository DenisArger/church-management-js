import { CommandResult } from "../types";
import { getAppConfig } from "../config/environment";
import {
  getTelegramConfigForMode,
  sendMessageToUser,
  sendMessageWithBot,
} from "../services/telegramService";
import { getRandomYouthReportReminder } from "../utils/youthReportReminderGenerator";
import { logInfo, logWarn, logError } from "../utils/logger";
import {
  getYouthLeadersMapping,
  hasYouthReportForLeaderInMonth,
} from "../services/notionService";

type ReminderSendOptions = {
  suppressDebugMessage?: boolean;
  forceDebug?: boolean;
  context?: Record<string, unknown>;
  mode?: "sendToAll" | "sendOnlyMissing";
  targetMonth?: {
    year: number;
    month: number; // 1..12
  };
};

export const sendYouthReportReminderToAdmins = async (
  options?: ReminderSendOptions
): Promise<CommandResult> => {
  try {
    const appConfig = getAppConfig();
    const youthLeaders = await getYouthLeadersMapping();
    const mode = options?.mode || "sendToAll";
    const allAdmins = Array.from(youthLeaders.keys());
    let adminUsers = allAdmins;
    const targetMonth = options?.targetMonth;

    if (allAdmins.length === 0) {
      logWarn("No active youth leaders configured for youth report reminder", {
        ...(options?.context || {}),
      });
      return { success: false, error: "No active youth leaders configured" };
    }

    const isDebug = options?.forceDebug ? true : appConfig.debug;
    const reminderText = getRandomYouthReportReminder();

    if (mode === "sendOnlyMissing") {
      if (!targetMonth) {
        return {
          success: false,
          error: "targetMonth is required for sendOnlyMissing mode",
        };
      }

      const usersWithoutReport: number[] = [];
      for (const adminUserId of allAdmins) {
        const leaderName = youthLeaders.get(adminUserId);
        if (!leaderName) continue;

        const hasReport = await hasYouthReportForLeaderInMonth(
          leaderName,
          targetMonth.year,
          targetMonth.month
        );

        if (!hasReport) {
          usersWithoutReport.push(adminUserId);
        }
      }

      adminUsers = usersWithoutReport;

      logInfo("Youth report follow-up check completed", {
        mode,
        targetMonth,
        leadersChecked: allAdmins.length,
        remindersToSend: adminUsers.length,
        skippedAsCompleted: allAdmins.length - adminUsers.length,
        ...(options?.context || {}),
      });

      if (adminUsers.length === 0) {
        return {
          success: true,
          message: "No follow-up reminders needed",
          data: {
            mode,
            targetMonth,
            leadersChecked: allAdmins.length,
            remindersSent: 0,
            skippedAsCompleted: allAdmins.length,
          },
        };
      }
    }

    if (isDebug) {
      const debugConfig = getTelegramConfigForMode(true);
      if (!debugConfig.chatId) {
        return { success: false, error: "Debug chat ID not configured" };
      }

      logInfo("DEBUG mode is active, sending youth report reminder to debug chat", {
        targetChatId: debugConfig.chatId,
        mode,
        targetMonth,
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
        mode,
        targetMonth,
        successCount,
        total: adminUsers.length,
        ...(options?.context || {}),
      });
      return {
        success: true,
        message: "Youth report reminders sent",
        data: {
          mode,
          targetMonth,
          leadersChecked: allAdmins.length,
          remindersSent: successCount,
          skippedAsCompleted:
            mode === "sendOnlyMissing" ? allAdmins.length - adminUsers.length : 0,
        },
      };
    }

    logError("Failed to send youth report reminders to all admins", {
      lastError,
      ...(options?.context || {}),
    });

    return {
      success: false,
      error: lastError || "Failed to send youth report reminders",
    };
  } catch (error) {
    logError("Failed to send youth report reminders", {
      error: error instanceof Error ? error.message : String(error),
      ...(options?.context || {}),
    });
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to send youth report reminders",
    };
  }
};
