import { CommandResult, PrayerRecord } from "../types";
import { sendMessage } from "../services/telegramService";
import { getWeeklyPrayerRecords } from "../services/notionService";
import { logInfo, logWarn } from "../utils/logger";
import { addDays, formatDateShort } from "../utils/dateHelper";

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

    // Calculate next week's date range
    const today = new Date();
    const nextWeekStart = addDays(today, 7 - today.getDay() + 1); // Next Monday
    const nextWeekEnd = addDays(nextWeekStart, 6); // Next Sunday

    logInfo("Looking for prayer records for next week", {
      nextWeekStart: nextWeekStart.toISOString().split("T")[0],
      nextWeekEnd: nextWeekEnd.toISOString().split("T")[0],
    });

    // Filter records for next week
    const nextWeekPrayers = prayerRecords.filter((record) => {
      const recordStart = new Date(record.dateStart);
      const recordEnd = new Date(record.dateEnd);

      // Check if prayer period overlaps with next week
      return (
        (recordStart <= nextWeekEnd && recordEnd >= nextWeekStart) ||
        (recordStart >= nextWeekStart && recordStart <= nextWeekEnd) ||
        (recordEnd >= nextWeekStart && recordEnd <= nextWeekEnd)
      );
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
    logWarn("Error in prayer week command", error);
    return {
      success: false,
      error:
        "Произошла ошибка при получении информации о молитвах на следующую неделю",
    };
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
