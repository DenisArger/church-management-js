import { CommandResult } from "../types";
import { sendMessage } from "../services/telegramService";
import { getWeeklyPrayerRecords } from "../services/notionService";
import { logInfo, logWarn } from "../utils/logger";
import { getAppConfig } from "../config/environment";
import {
  groupPrayerRecordsByPerson,
  sortPeopleByName,
  sortPeopleByDate,
  formatAllPeopleMessage,
  formatThreePeopleMessage,
} from "../utils/messageFormatter";

export const executePrayerRequestCommand = async (
  userId: number,
  chatId: number,
  params: string[] = []
): Promise<CommandResult> => {
  logInfo("Executing prayer request command", { userId, chatId, params });

  const config = getAppConfig();

  // Parse sort parameter
  const sortParam = params[0]?.toLowerCase();
  const validSortOptions = ["date", "name", "дата", "имя"];

  if (sortParam && !validSortOptions.includes(sortParam)) {
    return await sendMessage(
      chatId,
      "❌ Неверный параметр сортировки.\n\n" +
        "Доступные варианты:\n" +
        "• `/request_pray date` - сортировка по дате (по умолчанию)\n" +
        "• `/request_pray name` - сортировка по имени\n\n" +
        "Или используйте `/help` для полного списка команд."
    );
  }

  // Check DEBUG mode
  if (config.debug) {
    logInfo("DEBUG mode is active, newsletter will not be sent", { userId });
    return await sendMessage(
      chatId,
      "DEBUG-режим активен, рассылка не будет отправлена"
    );
  }

  try {
    const prayerRecords = await getWeeklyPrayerRecords();

    if (prayerRecords.length === 0) {
      logInfo("No prayer records found for newsletter");
      return await sendMessage(chatId, "Нет данных для рассылки.");
    }

    // Group records by person and find latest prayer date for each
    const lastPrayerByPerson = groupPrayerRecordsByPerson(prayerRecords);

    if (lastPrayerByPerson.size === 0) {
      logInfo("No valid prayer records found after grouping");
      return await sendMessage(chatId, "Нет данных для рассылки.");
    }

    // Convert map to array for processing
    const peopleInfo = Array.from(lastPrayerByPerson.values());

    // Determine sort order based on parameter
    const sortByName = sortParam === "name" || sortParam === "имя";

    let sortedPeople: typeof peopleInfo;
    let sortDescription: string;

    if (sortByName) {
      sortedPeople = sortPeopleByName(peopleInfo);
      sortDescription = "по алфавиту";
    } else {
      // Default: sort by date (oldest first)
      sortedPeople = sortPeopleByDate(peopleInfo);
      sortDescription = "по дате (старые первыми)";
    }

    // Format and send complete list
    const allPeopleMessage = formatAllPeopleMessage(
      sortedPeople,
      sortDescription
    );
    const allPeopleResult = await sendMessage(chatId, allPeopleMessage, {
      parse_mode: "HTML",
    });

    if (!allPeopleResult.success) {
      return allPeopleResult;
    }

    // For three people selection, always use date sorting (oldest first)
    const sortedPeopleByDate = sortPeopleByDate(peopleInfo);
    const threePeople = sortedPeopleByDate.slice(0, 3);

    // Format and send three people message
    const threePeopleMessage = formatThreePeopleMessage(threePeople);
    const threePeopleResult = await sendMessage(chatId, threePeopleMessage, {
      parse_mode: "HTML",
    });

    if (threePeopleResult.success) {
      logInfo("Prayer newsletter sent successfully", {
        userId,
        chatId,
        totalPeople: peopleInfo.length,
        threePeopleCount: threePeople.length,
        sortBy: sortDescription,
      });
    }

    return threePeopleResult;
  } catch (error) {
    logWarn("Error in prayer request command", error);
    return {
      success: false,
      error: "Произошла ошибка при получении молитвенных записей",
    };
  }
};
