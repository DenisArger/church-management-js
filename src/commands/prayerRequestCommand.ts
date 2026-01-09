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
  formatOldPrayersMessage,
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

    // For old people selection, always use date sorting (oldest first)
    const sortedPeopleByDate = sortPeopleByDate(peopleInfo);
    const oldPeople = sortedPeopleByDate.slice(0, 5);

    // Format and send old people message
    const oldPeopleMessage = formatOldPrayersMessage(oldPeople);
    const oldPeopleResult = await sendMessage(chatId, oldPeopleMessage, {
      parse_mode: "HTML",
    });

    if (oldPeopleResult.success) {
      logInfo("Prayer newsletter sent successfully", {
        userId,
        chatId,
        totalPeople: peopleInfo.length,
        oldPeopleCount: oldPeople.length,
        sortBy: sortDescription,
      });
    }

    return oldPeopleResult;
  } catch (error) {
    logWarn("Error in prayer request command", error);
    return {
      success: false,
      error: "Произошла ошибка при получении молитвенных записей",
    };
  }
};

/**
 * Execute command to show all people with prayer dates
 * Supports sorting by date (default) or name
 */
export const executeAllPrayersCommand = async (
  userId: number,
  chatId: number,
  params: string[] = []
): Promise<CommandResult> => {
  logInfo("Executing all prayers command", { userId, chatId, params });

  const config = getAppConfig();

  // Parse sort parameter
  const sortParam = params[0]?.toLowerCase();
  const validSortOptions = ["date", "name", "дата", "имя"];

  if (sortParam && !validSortOptions.includes(sortParam)) {
    return await sendMessage(
      chatId,
      "❌ Неверный параметр сортировки.\n\n" +
        "Доступные варианты:\n" +
        "• `date` или `дата` - сортировка по дате (по умолчанию)\n" +
        "• `name` или `имя` - сортировка по имени\n"
    );
  }

  // Check DEBUG mode
  if (config.debug) {
    logInfo("DEBUG mode is active", { userId });
    return await sendMessage(
      chatId,
      "DEBUG-режим активен"
    );
  }

  try {
    const prayerRecords = await getWeeklyPrayerRecords();

    if (prayerRecords.length === 0) {
      logInfo("No prayer records found");
      return await sendMessage(chatId, "Нет данных для отображения.");
    }

    // Group records by person and find latest prayer date for each
    const lastPrayerByPerson = groupPrayerRecordsByPerson(prayerRecords);

    if (lastPrayerByPerson.size === 0) {
      logInfo("No valid prayer records found after grouping");
      return await sendMessage(chatId, "Нет данных для отображения.");
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
    const result = await sendMessage(chatId, allPeopleMessage, {
      parse_mode: "HTML",
    });

    if (result.success) {
      logInfo("All prayers list sent successfully", {
        userId,
        chatId,
        totalPeople: peopleInfo.length,
        sortBy: sortDescription,
      });
    }

    return result;
  } catch (error) {
    logWarn("Error in all prayers command", error);
    return {
      success: false,
      error: "Произошла ошибка при получении молитвенных записей",
    };
  }
};

/**
 * Execute command to show 5 people who haven't been prayed for recently
 * Always sorted by date (oldest first)
 */
export const executeOldPrayersCommand = async (
  userId: number,
  chatId: number,
  params: string[] = []
): Promise<CommandResult> => {
  logInfo("Executing old prayers command", { userId, chatId, params });

  const config = getAppConfig();

  // Check DEBUG mode
  if (config.debug) {
    logInfo("DEBUG mode is active", { userId });
    return await sendMessage(
      chatId,
      "DEBUG-режим активен"
    );
  }

  try {
    const prayerRecords = await getWeeklyPrayerRecords();

    if (prayerRecords.length === 0) {
      logInfo("No prayer records found");
      return await sendMessage(chatId, "Нет данных для отображения.");
    }

    // Group records by person and find latest prayer date for each
    const lastPrayerByPerson = groupPrayerRecordsByPerson(prayerRecords);

    if (lastPrayerByPerson.size === 0) {
      logInfo("No valid prayer records found after grouping");
      return await sendMessage(chatId, "Нет данных для отображения.");
    }

    // Convert map to array for processing
    const peopleInfo = Array.from(lastPrayerByPerson.values());

    // Always sort by date (oldest first) for old prayers
    const sortedPeopleByDate = sortPeopleByDate(peopleInfo);
    const oldPeople = sortedPeopleByDate.slice(0, 5);

    // Format and send old people message
    const oldPeopleMessage = formatOldPrayersMessage(oldPeople);
    const result = await sendMessage(chatId, oldPeopleMessage, {
      parse_mode: "HTML",
    });

    if (result.success) {
      logInfo("Old prayers list sent successfully", {
        userId,
        chatId,
        totalPeople: peopleInfo.length,
        oldPeopleCount: oldPeople.length,
      });
    }

    return result;
  } catch (error) {
    logWarn("Error in old prayers command", error);
    return {
      success: false,
      error: "Произошла ошибка при получении молитвенных записей",
    };
  }
};
