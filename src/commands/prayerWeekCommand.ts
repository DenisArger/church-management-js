import { CommandResult, PrayerRecord } from "../types";
import { sendMessage } from "../services/telegramService";
import { getWeeklyPrayerRecords } from "../services/notionService";
import { logInfo, logWarn } from "../utils/logger";
import { addDays, formatDateForNotion, formatDateShort } from "../utils/dateHelper";

/**
 * Execute /prayer_week command
 * Gets and sends information about who we will pray for next week and prayer topics
 */
export const executePrayerWeekCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult> => {
  logInfo("Executing prayer week command", { userId, chatId });

  try {
    const prayerRecords = await getWeeklyPrayerRecords();

    if (prayerRecords.length === 0) {
      logInfo("No prayer records found");
      return await sendMessage(chatId, "Нет записей о молитвах.");
    }

    // Calculate next week's date range using the same Monday-to-Sunday logic
    // as the weekly schedule code. This keeps the command stable across timezones.
    const today = new Date();
    const currentDay = today.getDay();
    const daysUntilMonday = currentDay === 0 ? 1 : currentDay === 1 ? 7 : 8 - currentDay;

    const nextWeekStart = addDays(today, daysUntilMonday);
    nextWeekStart.setHours(0, 0, 0, 0);

    const nextWeekEnd = addDays(nextWeekStart, 6);
    nextWeekEnd.setHours(23, 59, 59, 999);

    const nextWeekStartStr = formatDateForNotion(nextWeekStart);
    const nextWeekEndStr = formatDateForNotion(nextWeekEnd);

    logInfo("Looking for prayer records for next week", {
      nextWeekStart: nextWeekStartStr,
      nextWeekEnd: nextWeekEndStr,
    });

    // Filter records for next week
    const nextWeekPrayers = prayerRecords.filter((record) => {
      const recordStart = formatDateForNotion(new Date(record.dateStart));
      const recordEnd = formatDateForNotion(new Date(record.dateEnd));

      // Check if prayer period overlaps with next week using date-only values.
      // This avoids timezone drift when Notion date ranges are compared in JS.
      return recordStart <= nextWeekEndStr && recordEnd >= nextWeekStartStr;
    });

    if (nextWeekPrayers.length === 0) {
      logInfo("No prayer records found for next week");
      return await sendMessage(
        chatId,
        `📅 <b>Молитва на следующую неделю</b>\n\n` +
          `Период: ${formatDateShort(nextWeekStart)} - ${formatDateShort(
            nextWeekEnd
          )}\n\n` +
          `❌ На следующую неделю не запланировано молитвенных записей.`
      );
    }

    // Format message for next week's prayers
    const message = formatPrayerWeekMessage(
      nextWeekPrayers,
      nextWeekStart,
      nextWeekEnd
    );

    const result = await sendMessage(chatId, message, {
      parse_mode: "HTML",
    });

    if (result.success) {
      logInfo("Prayer week information sent successfully", {
        userId,
        chatId,
        prayersCount: nextWeekPrayers.length,
      });
    }

    return result;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logWarn("Error in prayer week command", error);
    return await sendMessage(
      chatId,
      `❌ Ошибка при получении молитв: ${detail}`
    );
  }
};

/**
 * Formats the message about prayers for next week
 */
const formatPrayerWeekMessage = (
  prayers: PrayerRecord[],
  weekStart: Date,
  weekEnd: Date
): string => {
  let message = `🌟  <b>Молитва на следующую неделю</b>🌟 \n\n`;

  // Group prayers by person to avoid duplicates
  const prayersByPerson = new Map<string, PrayerRecord[]>();

  for (const prayer of prayers) {
    if (!prayersByPerson.has(prayer.person)) {
      prayersByPerson.set(prayer.person, []);
    }
    prayersByPerson.get(prayer.person)!.push(prayer);
  }

  // Format each person's prayer information
  for (const [person, personPrayers] of prayersByPerson) {
    message += `🙏 <b>За кого молимся:</b> ${person}\n`;

    // Get the most relevant prayer (prefer the one that starts in next week)
    const relevantPrayer =
      personPrayers.find(
        (p) =>
          new Date(p.dateStart) >= weekStart && new Date(p.dateStart) <= weekEnd
      ) || personPrayers[0];

    if (relevantPrayer.topic) {
      message += `📝 <b>Тема молитвы:</b> ${relevantPrayer.topic}\n`;
    }

    message += `📅 <b>Период молитвы:</b> ${formatDateShort(
      relevantPrayer.dateStart
    )} - ${formatDateShort(relevantPrayer.dateEnd)}\n`;
  }

  message += `\nБлагословений и хорошей недели! 🙏`;
  return message;
};
