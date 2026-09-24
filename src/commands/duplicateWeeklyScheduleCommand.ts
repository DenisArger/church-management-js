import { CommandResult } from "../types";
import { sendMessage } from "../services/telegramService";
import { getScheduleServicesForWeek, createScheduleService } from "../services/calendar/weeklySchedule";
import { logInfo, logError } from "../utils/logger";

/**
 * Duplicate current week services to next week
 * Creates new Notion entries with dates shifted by +7 days
 */
export const executeDuplicateWeeklyScheduleCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult> => {
  logInfo("Executing duplicate weekly schedule command", { userId, chatId });

  try {
    // Get all services for current week (without mailing filter)
    const currentWeekServices = await getScheduleServicesForWeek("current");

    if (!currentWeekServices || currentWeekServices.length === 0) {
      return await sendMessage(chatId, "📭 В текущей неделе нет служений для копирования.", {
        parse_mode: "HTML",
      });
    }

    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const service of currentWeekServices) {
      // Calculate next week date (+7 days)
      const nextWeekDate = new Date(service.date);
      nextWeekDate.setDate(nextWeekDate.getDate() + 7);

      const result = await createScheduleService({
        title: service.title,
        date: nextWeekDate,
        time: service.time,
        type: service.type,
        description: service.description,
        location: service.location,
        needsMailing: service.needsMailing,
      });

      if (result.success) {
        created++;
        logInfo("Duplicated service to next week", {
          originalId: service.id,
          title: service.title,
          originalDate: service.date.toISOString().split("T")[0],
          newDate: nextWeekDate.toISOString().split("T")[0],
        });
      } else {
        failed++;
        errors.push(`${service.title}: ${result.error}`);
        logError("Failed to duplicate service", { title: service.title, error: result.error });
      }
    }

    let message = `✅ <b>Копирование недели завершено</b>\n\n`;
    message += `📅 Исходная неделя: ${currentWeekServices.length} служений\n`;
    message += `✅ Создано: ${created}\n`;
    message += `❌ Ошибок: ${failed}\n`;

    if (errors.length > 0) {
      message += `\n⚠️ <b>Ошибки:</b>\n${errors.slice(0, 5).join("\n")}`;
      if (errors.length > 5) {
        message += `\n... и ещё ${errors.length - 5}`;
      }
    }

    const finalResult = await sendMessage(chatId, message, { parse_mode: "HTML" });
    if (!finalResult.success && finalResult.error) {
      return { success: false, error: finalResult.error };
    }
    return finalResult;
  } catch (error) {
    logError("Error duplicating weekly schedule", error);
    return { success: false, error: error instanceof Error ? error.message : "Произошла неизвестная ошибка при копировании недели" };
  }
};