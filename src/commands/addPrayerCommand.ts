import { CommandResult, PrayerFormState } from "../types";
import { sendMessage } from "../services/telegramService";
import { createWeeklyPrayerRecord, getWeeklyPrayerRecords } from "../services/notionService";
import { logInfo, logWarn, logError } from "../utils/logger";
import {
  createWeeklyPrayerInput,
  formatDateRange,
  calculateWeekDates,
} from "../utils/prayerInputParser";
import {
  getPrayerState,
  initPrayerState,
  updatePrayerStep,
  updatePrayerData,
  setWaitingForTextInput,
  setMessageId,
  clearPrayerState,
  hasActivePrayerState,
} from "../utils/prayerState";
import {
  buildWeekSelectionKeyboard,
  buildPersonSelectionKeyboard,
  buildConfirmationKeyboard,
  buildTopicInputKeyboard,
  buildPreviousTopicsKeyboard,
  getStepMessage,
  buildReviewMessage,
} from "../utils/prayerFormBuilder";
import { getOldPrayersForSelection } from "../utils/messageFormatter";


/**
 * Execute /add_prayer command
 * If no parameters and no active state, show week selection menu
 * If active state exists, handle text input
 */
export const executeAddPrayerCommand = async (
  userId: number,
  chatId: number,
  params: string[] = []
): Promise<CommandResult> => {
  logInfo("Executing add prayer command", { userId, chatId, params });

  // Check if user has active prayer form state
  if (await hasActivePrayerState(userId)) {
    // Handle text input for topic or new person name
    return await handlePrayerTextInput(userId, chatId, params.join(" "));
  }

  // If parameters provided, use old format (backward compatibility)
  if (params.length > 0) {
    return await handleLegacyFormat(userId, chatId, params);
  }

  // No parameters and no active state - start interactive form
  try {
    // Initialize state
    const state = await initPrayerState(userId, chatId);

    // Send initial message with week selection
    const keyboard = buildWeekSelectionKeyboard();
    const message = getStepMessage("week", state.data);
    const result = await sendMessage(chatId, message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });

    if (result.success && result.data?.messageId) {
      await setMessageId(userId, result.data.messageId as number);
    }

    return result;
  } catch (error) {
    logError("Error in add prayer command", error);
    return {
      success: false,
      error: "Произошла ошибка при запуске добавления молитвы",
    };
  }
};

/**
 * Handle callback query for prayer form
 */
export const handlePrayerCallback = async (
  userId: number,
  chatId: number,
  callbackData: string,
  messageId?: number
): Promise<CommandResult> => {
  logInfo("Handling prayer callback", { userId, callbackData });

  try {
    const state = await getPrayerState(userId);
    if (!state) {
      // State lost - try to recover by checking if this is a person selection
      // and we can infer the week type from the callback or reinitialize
      if (callbackData.startsWith("prayer:person:")) {
        // Try to reinitialize state and show person selection again
        // This handles the case where state was lost in serverless environment
        await initPrayerState(userId, chatId);
        // Try to get week type from previous message or default to current
        // For now, default to current week
        await updatePrayerData(userId, { weekType: "current" });
        await updatePrayerStep(userId, "person");
        
        try {
          const records = await getWeeklyPrayerRecords();
          const oldPeople = getOldPrayersForSelection(records, 5);
          await updatePrayerData(userId, {
            peopleList: oldPeople.map(p => ({
              person: p.person,
              date: p.date,
              record: {
                id: p.record.id,
                person: p.record.person,
                topic: p.record.topic,
                note: p.record.note,
                column: p.record.column,
                dateStart: p.record.dateStart,
                dateEnd: p.record.dateEnd,
              },
            })),
          });
          
          // Now handle person selection with recovered state
          const recoveredState = await getPrayerState(userId);
          if (recoveredState) {
            return await handlePersonSelection(userId, chatId, callbackData, recoveredState);
          }
        } catch (error) {
          logError("Error recovering state", error);
        }
      }
      
      return {
        success: false,
        error: "Сессия не найдена. Начните заново с команды /add_prayer",
      };
    }

    // Update message ID if provided
    if (messageId) {
      await setMessageId(userId, messageId);
    }

    const parts = callbackData.split(":");
    const action = parts[1];

    switch (action) {
      case "week":
        return await handleWeekSelection(userId, chatId, parts[2], state);
      case "person":
        return await handlePersonSelection(userId, chatId, callbackData, state);
      case "topic":
        return await handleTopicAction(userId, chatId, callbackData, state);
      case "confirm":
        return await handleConfirm(userId, chatId, state);
      case "cancel":
        return await handleCancel(userId, chatId, state);
      default:
        logWarn("Unknown prayer callback action", { action, callbackData, parts });
        return { success: false, error: "Неизвестное действие" };
    }
  } catch (error) {
    logError("Error handling prayer callback", error);
    return {
      success: false,
      error: "Произошла ошибка при обработке запроса",
    };
  }
};

/**
 * Handle week selection
 */
const handleWeekSelection = async (
  userId: number,
  chatId: number,
  weekType: string,
  state: PrayerFormState | undefined
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  if (weekType !== "current" && weekType !== "next") {
    return { success: false, error: "Invalid week type" };
  }

  // Save week type
  await updatePrayerData(userId, { weekType: weekType as "current" | "next" });
  await updatePrayerStep(userId, "person");

    // Get old prayers for selection
    try {
      const records = await getWeeklyPrayerRecords();
      const oldPeople = getOldPrayersForSelection(records, 5);
      
      // Store people list in state for decoding indices
      await updatePrayerData(userId, {
        peopleList: oldPeople.map(p => ({
          person: p.person,
          date: p.date,
          record: {
            id: p.record.id,
            person: p.record.person,
            topic: p.record.topic,
            note: p.record.note,
            column: p.record.column,
            dateStart: p.record.dateStart,
            dateEnd: p.record.dateEnd,
          },
        })),
      });

    // Build person selection keyboard
    const keyboard = buildPersonSelectionKeyboard(oldPeople);
    const message = getStepMessage("person", state.data, oldPeople);
    
    return await sendMessage(chatId, message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } catch (error) {
    logError("Error getting prayer records", error);
    return {
      success: false,
      error: "Произошла ошибка при получении списка людей",
    };
  }
};

/**
 * Handle person selection
 */
const handlePersonSelection = async (
  userId: number,
  chatId: number,
  callbackData: string,
  state: PrayerFormState | undefined
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  const parts = callbackData.split(":");
  const personAction = parts[2];

  if (personAction === "new") {
    // User wants to add new person - request text input
    await updatePrayerStep(userId, "topic");
    await setWaitingForTextInput(userId, true);
    // We'll handle this as "new person" mode - first ask for name, then topic
    // For now, we'll set a flag that we're waiting for person name
    await updatePrayerData(userId, { person: "__NEW__" });
    
    return await sendMessage(
      chatId,
      "👤 <b>Введите имя нового человека</b>\n\nВведите имя человека для молитвы:\n\n<i>Минимум 2 символа</i>",
      { parse_mode: "HTML" }
    );
  }

  // Decode person index
  // For callbackData "prayer:person:idx:2", parts[2]="idx", parts[3]="2"
  if (personAction === "idx" && parts.length > 3) {
    const indexStr = parts[3];
    const index = parseInt(indexStr, 10);
    
    const peopleList = state.data.peopleList || [];
    if (index < 0 || index >= peopleList.length) {
      return {
        success: false,
        error: "Не удалось найти выбранного человека",
      };
    }
    const personName = peopleList[index].person;
    
    // Save person name
    await updatePrayerData(userId, { person: personName });
    await updatePrayerStep(userId, "topic");
    await setWaitingForTextInput(userId, true);

    // Get previous week's topics for this person
    const previousTopics = await getPreviousWeekTopics(personName);
    
    const message = getStepMessage("topic", { ...state.data, person: personName });
    const keyboard = buildTopicInputKeyboard(previousTopics);
    
    return await sendMessage(chatId, message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  }

  return { success: false, error: "Неизвестный формат выбора человека" };
};

/**
 * Normalize person name for comparison
 * Removes extra spaces and trims the string
 */
const normalizePersonName = (name: string): string => {
  return name.trim().replace(/\s+/g, " ");
};

/**
 * Check if date is within date range (by date only, ignoring time)
 */
const isDateInRange = (date: Date, startDate: Date, endDate: Date): boolean => {
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const startOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return dateOnly >= startOnly && dateOnly <= endOnly;
};

/**
 * Get last topic from reference week (for any person)
 * If weekType is "next", returns topic from current week
 * If weekType is "current", returns topic from previous week
 */
const getLastReferenceWeekTopic = async (
  weekType: "current" | "next"
): Promise<string | null> => {
  try {
    const records = await getWeeklyPrayerRecords();
    const now = new Date();
    const currentDay = now.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const currentMonday = new Date(now);
    currentMonday.setDate(now.getDate() + mondayOffset);
    currentMonday.setHours(0, 0, 0, 0);
    
    let referenceWeekStart: Date;
    let referenceWeekEnd: Date;
    
    if (weekType === "next") {
      // For next week, use current week as reference
      referenceWeekStart = new Date(currentMonday);
      referenceWeekStart.setHours(0, 0, 0, 0);
      referenceWeekEnd = new Date(currentMonday);
      referenceWeekEnd.setDate(currentMonday.getDate() + 6);
      referenceWeekEnd.setHours(23, 59, 59, 999);
    } else {
      // For current week, use previous week as reference
      referenceWeekStart = new Date(currentMonday);
      referenceWeekStart.setDate(currentMonday.getDate() - 7);
      referenceWeekStart.setHours(0, 0, 0, 0);
      referenceWeekEnd = new Date(referenceWeekStart);
      referenceWeekEnd.setDate(referenceWeekStart.getDate() + 6);
      referenceWeekEnd.setHours(23, 59, 59, 999);
    }
    
    // Filter records for reference week (any person)
    const referenceWeekRecords = records.filter((record) => {
      // Compare dates by date only (ignoring time) to avoid timezone issues
      return isDateInRange(record.dateStart, referenceWeekStart, referenceWeekEnd);
    });
    
    if (referenceWeekRecords.length === 0) {
      return null;
    }
    
    // Sort by date (newest first) and return the last topic
    const sortedRecords = referenceWeekRecords.sort(
      (a, b) => b.dateStart.getTime() - a.dateStart.getTime()
    );
    
    return sortedRecords[0].topic;
  } catch (error) {
    logError("Error getting last reference week topic", error);
    return null;
  }
};

/**
 * Get previous week's topics for a person
 */
const getPreviousWeekTopics = async (
  personName: string
): Promise<Array<{ topic: string; date: Date }>> => {
  try {
    const records = await getWeeklyPrayerRecords();
    const now = new Date();
    const currentDay = now.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const currentMonday = new Date(now);
    currentMonday.setDate(now.getDate() + mondayOffset);
    currentMonday.setHours(0, 0, 0, 0);
    
    // Calculate previous week (last week)
    const previousWeekStart = new Date(currentMonday);
    previousWeekStart.setDate(currentMonday.getDate() - 7);
    previousWeekStart.setHours(0, 0, 0, 0);
    const previousWeekEnd = new Date(previousWeekStart);
    previousWeekEnd.setDate(previousWeekStart.getDate() + 6);
    previousWeekEnd.setHours(23, 59, 59, 999);
    
    // Normalize person name for comparison
    const normalizedPersonName = normalizePersonName(personName);
    
    // Filter records for this person in previous week
    const previousWeekRecords = records.filter((record) => {
      // Normalize record person name for comparison
      const normalizedRecordPerson = normalizePersonName(record.person);
      if (normalizedRecordPerson !== normalizedPersonName) return false;
      
      // Compare dates by date only (ignoring time) to avoid timezone issues
      return isDateInRange(record.dateStart, previousWeekStart, previousWeekEnd);
    });
    
    // Sort by date (oldest first) and return topics with dates
    return previousWeekRecords
      .sort((a, b) => a.dateStart.getTime() - b.dateStart.getTime())
      .map((record) => ({
        topic: record.topic,
        date: record.dateStart,
      }));
  } catch (error) {
    logError("Error getting previous week topics", error);
    return [];
  }
};

/**
 * Handle topic-related actions (copy, show previous, select previous)
 */
const handleTopicAction = async (
  userId: number,
  chatId: number,
  callbackData: string,
  state: PrayerFormState | undefined
): Promise<CommandResult> => {
  if (!state || !state.data.person) {
    return { success: false, error: "State not found or person not selected" };
  }

  const parts = callbackData.split(":");
  const topicAction = parts[2];

  if (topicAction === "copy_last") {
    // Copy last topic from reference week (any person)
    // For next week, use current week; for current week, use previous week
    const weekType = state.data.weekType || "current";
    const lastTopic = await getLastReferenceWeekTopic(weekType);
    if (!lastTopic) {
      const weekText = weekType === "next" ? "текущей" : "прошлой";
      return await sendMessage(
        chatId,
        `❌ Нет тем ${weekText} недели.`,
        { parse_mode: "HTML" }
      );
    }
    
    await updatePrayerData(userId, { topic: lastTopic });
    await setWaitingForTextInput(userId, false);
    
    const reviewMessage = buildReviewMessage({
      ...state.data,
      topic: lastTopic,
    });
    const keyboard = buildConfirmationKeyboard();
    
    return await sendMessage(chatId, reviewMessage, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  }

  if (topicAction === "show_previous") {
    // Show list of previous week's topics
    const previousTopics = await getPreviousWeekTopics(state.data.person);
    if (previousTopics.length === 0) {
      return await sendMessage(
        chatId,
        "❌ Нет тем прошлой недели для этого человека.",
        { parse_mode: "HTML" }
      );
    }
    
    // Store previous topics in state for selection
    await updatePrayerData(userId, {
      previousTopics: previousTopics.map(t => ({
        topic: t.topic,
        date: t.date,
      })),
    });
    
    const keyboard = buildPreviousTopicsKeyboard(previousTopics);
    const message = `📚 <b>Темы прошлой недели для ${state.data.person}</b>\n\nВыберите тему:`;
    
    return await sendMessage(chatId, message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  }

  if (topicAction === "previous" && parts.length > 4) {
    // User selected a topic from previous week
    // callbackData format: prayer:topic:previous:idx:0
    // parts: ["prayer", "topic", "previous", "idx", "0"]
    const indexStr = parts[4]; // Get index from parts[4]
    if (!indexStr) {
      return { success: false, error: "Invalid topic index" };
    }
    
    const index = parseInt(indexStr, 10);
    const previousTopics = state.data.previousTopics || [];
    
    if (index < 0 || index >= previousTopics.length) {
      return { success: false, error: "Invalid topic index" };
    }
    
    const selectedTopic = previousTopics[index].topic;
    await updatePrayerData(userId, { topic: selectedTopic });
    await setWaitingForTextInput(userId, false);
    
    const reviewMessage = buildReviewMessage({
      ...state.data,
      topic: selectedTopic,
    });
    const keyboard = buildConfirmationKeyboard();
    
    return await sendMessage(chatId, reviewMessage, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  }

  if (topicAction === "new") {
    // User wants to add new topic - request text input
    await setWaitingForTextInput(userId, true);
    
    return await sendMessage(
      chatId,
      `📝 <b>Введите новую тему молитвы</b>\n\nВведите тему молитвы для <b>${state.data.person}</b>:\n\n<i>Минимум 3 символа</i>`,
      { parse_mode: "HTML" }
    );
  }

  if (topicAction === "back") {
    // Go back to topic input
    const previousTopics = await getPreviousWeekTopics(state.data.person);
    const message = getStepMessage("topic", state.data);
    const keyboard = buildTopicInputKeyboard(previousTopics);
    
    return await sendMessage(chatId, message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  }

  return { success: false, error: "Unknown topic action" };
};

/**
 * Handle text input for prayer form
 */
const handlePrayerTextInput = async (
  userId: number,
  chatId: number,
  text: string
): Promise<CommandResult> => {
  const state = await getPrayerState(userId);
  if (!state) {
    return {
      success: false,
      error: "Сессия не найдена. Начните заново с команды /add_prayer",
    };
  }

  if (!text || text.trim().length === 0) {
    return await sendMessage(chatId, "❌ Пустой ввод. Пожалуйста, введите данные.");
  }

  const trimmedText = text.trim();

  // Check if we're waiting for new person name
  if (state.data.person === "__NEW__") {
    // Validate person name
    if (trimmedText.length < 2) {
      return await sendMessage(
        chatId,
        "❌ Имя человека должно содержать минимум 2 символа. Попробуйте еще раз:",
        { parse_mode: "HTML" }
      );
    }

    // Save person name and ask for topic
    await updatePrayerData(userId, { person: trimmedText });
    const message = getStepMessage("topic", { ...state.data, person: trimmedText });
    return await sendMessage(chatId, message, {
      parse_mode: "HTML",
    });
  }

  // We're waiting for topic
  if (state.step === "topic") {
    // Validate topic
    if (trimmedText.length < 3) {
      return await sendMessage(
        chatId,
        "❌ Тема молитвы должна содержать минимум 3 символа. Попробуйте еще раз:",
        { parse_mode: "HTML" }
      );
    }

    // Save topic and show confirmation
    await updatePrayerData(userId, { topic: trimmedText });
    await setWaitingForTextInput(userId, false);

    const reviewMessage = buildReviewMessage({
      ...state.data,
      topic: trimmedText,
    });
    const keyboard = buildConfirmationKeyboard();

    return await sendMessage(chatId, reviewMessage, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  }

  return { success: false, error: "Неожиданное состояние формы" };
};

/**
 * Handle confirmation and save to Notion
 */
const handleConfirm = async (
  userId: number,
  chatId: number,
  state: PrayerFormState | undefined
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  const { weekType, person, topic } = state.data;

  // Validate all required fields
  if (!weekType || !person || !topic) {
    return {
      success: false,
      error: "Не все поля заполнены. Начните заново.",
    };
  }

  // Validate person name
  if (person.length < 2) {
    return {
      success: false,
      error: "Имя человека должно содержать минимум 2 символа",
    };
  }

  // Validate topic
  if (topic.length < 3) {
    return {
      success: false,
      error: "Тема молитвы должна содержать минимум 3 символа",
    };
  }

  try {
    // Create prayer input
    const dates = calculateWeekDates(weekType);
    const prayerInput = {
      person,
      topic,
      note: "",
      weekType,
      dateStart: dates.start,
      dateEnd: dates.end,
    };

    // Save to Notion
    const result = await createWeeklyPrayerRecord(prayerInput);

    if (result.success) {
      const successMessage = `
✅ <b>Молитвенная запись успешно добавлена!</b>

🙏 <b>Молитвенное лицо:</b> ${prayerInput.person}
📝 <b>Тема:</b> ${prayerInput.topic}
📅 <b>Период:</b> ${formatDateRange(prayerInput.dateStart, prayerInput.dateEnd)}
🗓️ <b>Неделя:</b> ${
        prayerInput.weekType === "current" ? "Текущая" : "Предстоящая"
      }

Запись сохранена в базе данных Notion.
`;

      logInfo("Prayer record added successfully", {
        userId,
        chatId,
        person: prayerInput.person,
        topic: prayerInput.topic,
        weekType: prayerInput.weekType,
      });

      // Clear state
      await clearPrayerState(userId);

      return await sendMessage(chatId, successMessage, { parse_mode: "HTML" });
    } else {
      logWarn("Failed to add prayer record", { error: result.error });
      return await sendMessage(
        chatId,
        `❌ Ошибка при сохранении записи: ${result.error}\n\nПопробуйте еще раз или обратитесь к администратору.`
      );
    }
  } catch (error) {
    logError("Error saving prayer record", error);
    return {
      success: false,
      error: "Произошла ошибка при сохранении записи",
    };
  }
};

/**
 * Handle cancel
 */
const handleCancel = async (
  userId: number,
  chatId: number,
  _state: PrayerFormState | undefined
): Promise<CommandResult> => {
  await clearPrayerState(userId);
  return await sendMessage(
    chatId,
    "❌ Добавление молитвы отменено.",
    { parse_mode: "HTML" }
  );
};

/**
 * Handle legacy format (backward compatibility)
 */
const handleLegacyFormat = async (
  userId: number,
  chatId: number,
  params: string[]
): Promise<CommandResult> => {
  // Join all parameters into a single string
  const inputString = params.join(" ");

  try {
    // Use existing parser for legacy format
    const { parsePrayerInput, getPrayerInputHelp } = await import(
      "../utils/prayerInputParser"
    );
    const parseResult = parsePrayerInput(inputString);

    if (!parseResult.isValid || !parseResult.data) {
      return await sendMessage(
        chatId,
        `❌ ${parseResult.error}\n\n${getPrayerInputHelp()}`,
        { parse_mode: "HTML" }
      );
    }

    // Create prayer input object
    const prayerInput = createWeeklyPrayerInput(parseResult.data);

    // Save to Notion
    const result = await createWeeklyPrayerRecord(prayerInput);

    if (result.success) {
      const successMessage = `
✅ <b>Молитвенная запись успешно добавлена!</b>

🙏 <b>Молитвенное лицо:</b> ${prayerInput.person}
📝 <b>Тема:</b> ${prayerInput.topic}
${prayerInput.note ? `📌 <b>Примечание:</b> ${prayerInput.note}\n` : ""}
📅 <b>Период:</b> ${formatDateRange(prayerInput.dateStart, prayerInput.dateEnd)}
🗓️ <b>Неделя:</b> ${
        prayerInput.weekType === "current" ? "Текущая" : "Предстоящая"
      }

Запись сохранена в базе данных Notion.
`;

      logInfo("Prayer record added successfully (legacy format)", {
        userId,
        chatId,
        person: prayerInput.person,
        topic: prayerInput.topic,
        weekType: prayerInput.weekType,
      });

      return await sendMessage(chatId, successMessage, { parse_mode: "HTML" });
    } else {
      logWarn("Failed to add prayer record", { error: result.error });
      return await sendMessage(
        chatId,
        `❌ Ошибка при сохранении записи: ${result.error}\n\nПопробуйте еще раз или обратитесь к администратору.`
      );
    }
  } catch (error) {
    logWarn("Error in add prayer command (legacy format)", error);
    const { getPrayerInputHelp } = await import("../utils/prayerInputParser");
    return await sendMessage(
      chatId,
      `❌ Произошла ошибка при обработке команды.\n\n${getPrayerInputHelp()}`,
      { parse_mode: "HTML" }
    );
  }
};
