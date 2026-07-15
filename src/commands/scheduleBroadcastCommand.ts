import { CommandResult } from "../types";
import { scheduleBroadcastMailing } from "../services/youtubeBroadcastService";
import { computeMailScheduledFor } from "../services/youtubeApiService";
import { logInfo, logError, logWarn } from "../utils/logger";

/**
 * Execute /schedule_broadcast command
 * Usage: /schedule_broadcast <youtubeId> <title> <scheduledStartTime> [public|private]
 *
 * Example:
 *   /schedule_broadcast abc123XYZ "Утреннее служение" 2026-07-20T10:00:00Z public
 */
export const executeScheduleBroadcastCommand = async (
  userId: number,
  chatId: number,
  params: string[] = []
): Promise<CommandResult> => {
  logInfo("Executing schedule broadcast command", { userId, chatId, params });

  try {
    if (params.length < 3) {
      return {
        success: false,
        error:
          "Использование: /schedule_broadcast <youtubeId> <title> <scheduledStartTime> [public|private]\n" +
          "Пример: /schedule_broadcast abc123XYZ \"Утреннее служение\" 2026-07-20T10:00:00Z public",
      };
    }

    const [youtubeId, title, scheduledStartTime, privacyStatusRaw] = params;

    if (!youtubeId || !title || !scheduledStartTime) {
      return {
        success: false,
        error: "Необходимо указать youtubeId, title и scheduledStartTime",
      };
    }

    const privacyStatus = (privacyStatusRaw || "public") as "public" | "private" | "unlisted";

    const dt = new Date(scheduledStartTime);
    if (isNaN(dt.getTime())) {
      return {
        success: false,
        error: `Некорректный формат даты: ${scheduledStartTime}. Используйте ISO-строку, например 2026-07-20T10:00:00Z`,
      };
    }

    const mailing = await scheduleBroadcastMailing(
      {
        youtubeId,
        title,
        privacyStatus,
        scheduledStartTime,
      },
      5,
      computeMailScheduledFor(scheduledStartTime)
    );

    if (!mailing) {
      return {
        success: false,
        error: "Не удалось запланировать рассылку. Проверьте конфигурацию Supabase.",
      };
    }

    logInfo("Broadcast mailing scheduled via command", {
      userId,
      chatId,
      mailingId: mailing.id,
      youtubeId: mailing.youtubeId,
      scheduledFor: mailing.scheduledFor,
    });

    return {
      success: true,
      message:
        `✅ Рассылка трансляции запланирована на 9:00 (Минск)!\n` +
        `YouTube ID: ${youtubeId}\n` +
        `Название: ${title}\n` +
        `Время трансляции: ${dt.toLocaleString("ru-RU")}\n` +
        `Приватность: ${privacyStatus}\n` +
        `ID рассылки: ${mailing.id}`,
    };
  } catch (error) {
    logError("Error in schedule broadcast command", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
    };
  }
};
