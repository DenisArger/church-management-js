import { CommandResult, YouthReportState } from "../types";
import { sendMessage, sendMessageToUser } from "../services/telegramService";
import { 
  createYouthReportRecord, 
  getYouthPeopleForLeader,
  getLeaderByTelegramId 
} from "../services/notionService";
import { logInfo, logWarn, logError } from "../utils/logger";
import { getTelegramConfig } from "../config/environment";
import {
  getYouthReportState,
  initYouthReportState,
  updateYouthReportStep,
  updateYouthReportData,
  setWaitingForTextInput,
  setMessageId,
  clearYouthReportState,
  hasActiveYouthReportState,
} from "../utils/youthReportState";
import {
  buildPersonSelectionKeyboard,
  buildCommunicationKeyboard,
  buildEventsKeyboard,
  buildReviewKeyboard,
  buildEditFieldKeyboard,
  buildSkipKeyboard,
  getStepMessage,
  formatPreviewMessage,
  validateFormData,
  COMMUNICATION_TYPES,
  EVENT_TYPES,
} from "../utils/youthReportFormBuilder";

/**
 * Send notification to administrator about failure to get people list for leader
 */
const sendYouthReportPeopleListFailureNotification = async (
  leader: string,
  userId: number,
  chatId: number,
  errorMessage: string,
  context?: {
    databaseId?: string;
    additionalInfo?: string;
  }
): Promise<void> => {
  try {
    const telegramConfig = getTelegramConfig();
    
    // Get first allowed user as administrator
    const adminUsers = telegramConfig.allowedUsers;
    if (adminUsers.length === 0) {
      logWarn("No allowed users configured for youth report failure notifications");
      return;
    }
    
    const adminUserId = adminUsers[0];
    const timestamp = new Date();
    
    // Build detailed error message
    let message = `❌ ОШИБКА: Не удалось сформировать список людей для лидера\n\n`;
    message += `Лидер: ${leader}\n`;
    message += `Telegram ID пользователя: ${userId}\n`;
    message += `Chat ID: ${chatId}\n`;
    message += `Время ошибки: ${timestamp.toLocaleString("ru-RU")}\n\n`;
    message += `Ошибка: ${errorMessage}\n\n`;
    
    if (context?.databaseId) {
      message += `ID базы данных: ${context.databaseId}\n`;
    }
    
    if (context?.additionalInfo) {
      message += `\nДополнительная информация: ${context.additionalInfo}`;
    }
    
    message += `\n\nПожалуйста, проверьте:\n`;
    message += `1. Настройки базы данных Notion (NOTION_YOUTH_REPORT_DATABASE)\n`;
    message += `2. Права доступа к базе данных\n`;
    message += `3. Наличие записей для лидера "${leader}" в базе данных\n`;
    message += `4. Логи для дополнительной информации`;
    
    const result = await sendMessageToUser(adminUserId, message);
    
    if (result.success) {
      logInfo("Youth report people list failure notification sent to administrator", {
        adminUserId,
        leader,
        userId,
      });
    } else {
      logError("Failed to send youth report people list failure notification to administrator", {
        adminUserId,
        error: result.error,
        leader,
        userId,
      });
    }
  } catch (error) {
    logError("Error sending youth report people list failure notification", {
      error: error instanceof Error ? error.message : "Unknown error",
      leader,
      userId,
    });
  }
};

/**
 * Execute /youth_report command
 * If no parameters and no active state, start the form
 * If active state exists, handle text input
 */
export const executeYouthReportCommand = async (
  userId: number,
  chatId: number,
  params: string[] = []
): Promise<CommandResult> => {
  logInfo("Executing youth report command", { userId, chatId, params });

  // Check if user has active youth report form state
  const hasActiveState = await hasActiveYouthReportState(userId);

  if (hasActiveState) {
    // If params is empty, this is a command (not text input) - clear state and start new form
    if (params.length === 0) {
      await clearYouthReportState(userId);
      // Fall through to start new form
    } else {
      // Handle text input
      return await handleYouthReportTextInput(userId, chatId, params.join(" "));
    }
  }

  // No active state - start interactive form
  try {
    // Get leader name by Telegram ID
    const leader = await getLeaderByTelegramId(userId);
    if (!leader) {
      const errorResult = {
        success: false,
        error: "Не удалось определить лидера. Обратитесь к администратору.",
      };
      await sendMessage(chatId, errorResult.error);
      return errorResult;
    }

    // Initialize state
    const state = await initYouthReportState(userId, chatId, leader);

    // Get list of people for this leader
    let people: string[] = [];
    try {
      people = await getYouthPeopleForLeader(leader);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError("Error getting youth people for leader", {
        leader,
        userId,
        error: errorMessage,
      });
      
      const errorResult = {
        success: false,
        error: "Произошла ошибка при получении списка людей. Обратитесь к администратору.",
      };
      await sendMessage(chatId, errorResult.error);
      
      // Send notification to administrator
      await sendYouthReportPeopleListFailureNotification(
        leader,
        userId,
        chatId,
        `Исключение при получении списка людей: ${errorMessage}`,
        {
          additionalInfo: `Тип ошибки: ${error instanceof Error ? error.constructor.name : typeof error}`,
        }
      );
      
      return errorResult;
    }
    
    if (people.length === 0) {
      const errorResult = {
        success: false,
        error: "Не найдены люди, закрепленные за вами. Обратитесь к администратору.",
      };
      await sendMessage(chatId, errorResult.error);
      
      // Send notification to administrator
      await sendYouthReportPeopleListFailureNotification(
        leader,
        userId,
        chatId,
        "Список людей пуст - не найдено записей для лидера в базе данных",
        {
          additionalInfo: "Возможно, для этого лидера еще не созданы отчеты в базе данных.",
        }
      );
      
      return errorResult;
    }

    // Store people list in state for callback data decoding
    await updateYouthReportData(userId, { peopleList: people });

    // Send initial message with person selection
    const keyboard = buildPersonSelectionKeyboard(people);
    const message = getStepMessage("person", state.data);
    const result = await sendMessage(chatId, message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });

    if (result.success && result.data?.messageId) {
      await setMessageId(userId, result.data.messageId as number);
    }

    return result;
  } catch (error) {
    logError("Error in youth report command", error);
    const errorResult = {
      success: false,
      error: "Произошла ошибка при запуске формы отчета",
    };
    await sendMessage(chatId, errorResult.error);
    return errorResult;
  }
};

/**
 * Handle callback query for youth report form
 */
export const handleYouthReportCallback = async (
  userId: number,
  chatId: number,
  callbackData: string,
  messageId?: number
): Promise<CommandResult> => {
  logInfo("Handling youth report callback", { userId, callbackData });

  try {
    const state = await getYouthReportState(userId);
    if (!state) {
      return {
        success: false,
        error: "Сессия не найдена. Начните заново с команды /youth_report",
      };
    }

    // Update message ID if provided
    if (messageId) {
      await setMessageId(userId, messageId);
    }

    const parts = callbackData.split(":");
    const action = parts[1];

    switch (action) {
      case "person":
        return await handlePersonSelection(userId, chatId, callbackData, state);
      case "communication":
      case "comm": // Alias for shorter callback_data
        return await handleCommunicationSelection(userId, chatId, callbackData, state);
      case "events":
        return await handleEventsSelection(userId, chatId, callbackData, state);
      case "edit":
        return await handleEdit(userId, chatId, parts[2], state);
      case "skip":
        return await handleSkip(userId, chatId, parts[2], state);
      case "confirm":
        return await handleConfirm(userId, chatId, state);
      case "cancel":
        return await handleCancel(userId, chatId, state);
      default:
        logWarn("Unknown youth report callback action", { action, callbackData, parts });
        return { success: false, error: "Неизвестное действие" };
    }
  } catch (error) {
    logError("Error handling youth report callback", error);
    return {
      success: false,
      error: "Произошла ошибка при обработке запроса",
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
  state: YouthReportState | undefined
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  const parts = callbackData.split(":");
  // For callbackData "youth_report:person:idx:2", parts[2]="idx", parts[3]="2"
  if (parts[2] === "idx" && parts.length > 3) {
    const indexStr = parts[3];
    const index = parseInt(indexStr, 10);
    
    const peopleList = state.data.peopleList || [];
    if (index < 0 || index >= peopleList.length) {
      return {
        success: false,
        error: "Не удалось найти выбранного человека",
      };
    }
    const personName = peopleList[index];
    
    // Save person name
    await updateYouthReportData(userId, { person: personName });
    await updateYouthReportStep(userId, "communication");
    await setWaitingForTextInput(userId, false);

    const message = getStepMessage("communication", { ...state.data, person: personName });
    const keyboard = buildCommunicationKeyboard(state.data.communicationTypes || []);
    
    return await sendMessage(chatId, message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  }

  return { success: false, error: "Неизвестный формат выбора человека" };
};

/**
 * Handle communication type selection
 */
const handleCommunicationSelection = async (
  userId: number,
  chatId: number,
  callbackData: string,
  state: YouthReportState | undefined
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  const parts = callbackData.split(":");
  
  // Handle "done" action
  if (parts[2] === "done") {
    // User clicked "Готово"
    if (!state.data.communicationTypes || state.data.communicationTypes.length === 0) {
      return await sendMessage(
        chatId,
        "❌ Выберите хотя бы один способ общения.",
        { parse_mode: "HTML" }
      );
    }
    
    await updateYouthReportStep(userId, "events");
    await setWaitingForTextInput(userId, false);

    const message = getStepMessage("events", state.data);
    const keyboard = buildEventsKeyboard(state.data.events || []);
    
    return await sendMessage(chatId, message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  }

  // Handle index-based selection: youth_report:comm:idx:0
  if (parts[2] === "idx" && parts.length > 3) {
    const indexStr = parts[3];
    const index = parseInt(indexStr, 10);
    
    if (index < 0 || index >= COMMUNICATION_TYPES.length) {
      return {
        success: false,
        error: "Неверный индекс способа общения",
      };
    }
    
    const communicationType = COMMUNICATION_TYPES[index];
    
    // Toggle communication type
    const currentTypes = state.data.communicationTypes || [];
    let newTypes: string[];
    
    if (communicationType === "Другое") {
      // Request text input for "Другое"
      await updateYouthReportData(userId, { waitingForOtherText: "communication" });
      await setWaitingForTextInput(userId, true);
      
      return await sendMessage(
        chatId,
        "💬 <b>Укажите другой способ общения</b>\n\nВведите текст:",
        { parse_mode: "HTML" }
      );
    }

    if (currentTypes.includes(communicationType)) {
      // Remove if already selected
      newTypes = currentTypes.filter((t) => t !== communicationType);
    } else {
      // Add if not selected
      newTypes = [...currentTypes, communicationType];
    }

    await updateYouthReportData(userId, { communicationTypes: newTypes });

    // Update keyboard with new selection
    const message = getStepMessage("communication", state.data);
    const keyboard = buildCommunicationKeyboard(newTypes);
    
    return await sendMessage(chatId, message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  }

  return { success: false, error: "Неизвестный формат callback для способов общения" };
};

/**
 * Handle events selection
 */
const handleEventsSelection = async (
  userId: number,
  chatId: number,
  callbackData: string,
  state: YouthReportState | undefined
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  const parts = callbackData.split(":");
  
  // Handle "done" action
  if (parts[2] === "done") {
    // User clicked "Готово"
    await updateYouthReportStep(userId, "help");
    await setWaitingForTextInput(userId, true);

    const message = getStepMessage("help", state.data);
    const keyboard = buildSkipKeyboard("help");
    
    return await sendMessage(chatId, message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  }

  // Handle index-based selection: youth_report:events:idx:0
  if (parts[2] === "idx" && parts.length > 3) {
    const indexStr = parts[3];
    const index = parseInt(indexStr, 10);
    
    if (index < 0 || index >= EVENT_TYPES.length) {
      return {
        success: false,
        error: "Неверный индекс мероприятия",
      };
    }
    
    const eventType = EVENT_TYPES[index];
    
    // Toggle event type
    const currentEvents = state.data.events || [];
    let newEvents: string[];
    
    if (eventType === "Другое") {
      // Request text input for "Другое"
      await updateYouthReportData(userId, { waitingForOtherText: "events" });
      await setWaitingForTextInput(userId, true);
      
      return await sendMessage(
        chatId,
        "📅 <b>Укажите другое мероприятие</b>\n\nВведите текст:",
        { parse_mode: "HTML" }
      );
    }

    if (currentEvents.includes(eventType)) {
      // Remove if already selected
      newEvents = currentEvents.filter((e) => e !== eventType);
    } else {
      // Add if not selected
      newEvents = [...currentEvents, eventType];
    }

    await updateYouthReportData(userId, { events: newEvents });

    // Update keyboard with new selection
    const message = getStepMessage("events", state.data);
    const keyboard = buildEventsKeyboard(newEvents);
    
    return await sendMessage(chatId, message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  }

  return { success: false, error: "Неизвестный формат callback для мероприятий" };
};

/**
 * Handle edit field selection
 */
const handleEdit = async (
  userId: number,
  chatId: number,
  field: string | undefined,
  state: YouthReportState | undefined
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  if (!field) {
    // Show edit field selection
    const message = formatPreviewMessage(state.data);
    const keyboard = buildEditFieldKeyboard(state.data);
    
    return await sendMessage(chatId, `📋 <b>Выберите поле для редактирования:</b>\n\n${message}`, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  }

  switch (field) {
    case "person":
      // Reload people list
      const people = await getYouthPeopleForLeader(state.data.leader || "");
      if (people.length === 0) {
        return {
          success: false,
          error: "Не найдены люди, закрепленные за вами.",
        };
      }
      await updateYouthReportData(userId, { peopleList: people });
      await updateYouthReportStep(userId, "person");
      const personKeyboard = buildPersonSelectionKeyboard(people);
      const personMessage = getStepMessage("person", state.data);
      return await sendMessage(chatId, personMessage, {
        reply_markup: personKeyboard,
        parse_mode: "HTML",
      });

    case "communication":
      await updateYouthReportStep(userId, "communication");
      await setWaitingForTextInput(userId, false);
      const commMessage = getStepMessage("communication", state.data);
      const commKeyboard = buildCommunicationKeyboard(state.data.communicationTypes || []);
      return await sendMessage(chatId, commMessage, {
        reply_markup: commKeyboard,
        parse_mode: "HTML",
      });

    case "events":
      await updateYouthReportStep(userId, "events");
      await setWaitingForTextInput(userId, false);
      const eventsMessage = getStepMessage("events", state.data);
      const eventsKeyboard = buildEventsKeyboard(state.data.events || []);
      return await sendMessage(chatId, eventsMessage, {
        reply_markup: eventsKeyboard,
        parse_mode: "HTML",
      });

    case "help":
      await updateYouthReportStep(userId, "help");
      await setWaitingForTextInput(userId, true);
      const helpMessage = getStepMessage("help", state.data);
      const helpKeyboard = buildSkipKeyboard("help");
      return await sendMessage(chatId, helpMessage, {
        reply_markup: helpKeyboard,
        parse_mode: "HTML",
      });

    case "note":
      await updateYouthReportStep(userId, "note");
      await setWaitingForTextInput(userId, true);
      const noteMessage = getStepMessage("note", state.data);
      const noteKeyboard = buildSkipKeyboard("note");
      return await sendMessage(chatId, noteMessage, {
        reply_markup: noteKeyboard,
        parse_mode: "HTML",
      });

    default:
      return { success: false, error: "Неизвестное поле для редактирования" };
  }
};

/**
 * Handle skip button for optional fields (help, note)
 */
const handleSkip = async (
  userId: number,
  chatId: number,
  step: string | undefined,
  state: YouthReportState | undefined
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  if (step === "help") {
    // Skip help field
    await updateYouthReportData(userId, { help: "" });
    await updateYouthReportStep(userId, "note");
    await setWaitingForTextInput(userId, true);

    const message = getStepMessage("note", state.data);
    const keyboard = buildSkipKeyboard("note");
    
    return await sendMessage(chatId, message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } else if (step === "note") {
    // Skip note field
    await updateYouthReportData(userId, { note: "" });
    await updateYouthReportStep(userId, "review");
    await setWaitingForTextInput(userId, false);

    const reviewMessage = formatPreviewMessage(state.data);
    const keyboard = buildReviewKeyboard();
    
    return await sendMessage(chatId, reviewMessage, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  }

  return { success: false, error: "Неизвестный шаг для пропуска" };
};

/**
 * Handle text input for youth report form
 */
const handleYouthReportTextInput = async (
  userId: number,
  chatId: number,
  text: string
): Promise<CommandResult> => {
  const state = await getYouthReportState(userId);
  if (!state) {
    return {
      success: false,
      error: "Сессия не найдена. Начните заново с команды /youth_report",
    };
  }

  // Normalize text before checking if empty
  const normalizedText = text ? text.trim() : "";
  const isEmpty = normalizedText.length === 0;

  if (isEmpty) {
    // Allow empty text for optional fields
    if (state.step === "help" || state.step === "note") {
      // Skip optional fields
      if (state.step === "help") {
        await updateYouthReportData(userId, { help: "" });
        await updateYouthReportStep(userId, "note");
        await setWaitingForTextInput(userId, true);
        const message = getStepMessage("note", state.data);
        const keyboard = buildSkipKeyboard("note");
        return await sendMessage(chatId, message, {
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
      } else if (state.step === "note") {
        await updateYouthReportData(userId, { note: "" });
        await updateYouthReportStep(userId, "review");
        await setWaitingForTextInput(userId, false);
        const reviewMessage = formatPreviewMessage(state.data);
        const keyboard = buildReviewKeyboard();
        return await sendMessage(chatId, reviewMessage, {
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
      }
    }
    return await sendMessage(chatId, "❌ Пустой ввод. Пожалуйста, введите данные.");
  }

  const trimmedText = normalizedText;

  // Check if we're waiting for "other" text
  if (state.data.waitingForOtherText) {
    const waitingFor = state.data.waitingForOtherText;
    
    if (waitingFor === "communication") {
      // Add "Другое" to communication types if not already there
      const currentTypes = state.data.communicationTypes || [];
      if (!currentTypes.includes("Другое")) {
        currentTypes.push("Другое");
      }
      await updateYouthReportData(userId, {
        communicationTypes: currentTypes,
        communicationOther: trimmedText,
        waitingForOtherText: null,
      });
      await setWaitingForTextInput(userId, false);
      
      // Continue to events
      await updateYouthReportStep(userId, "events");
      const message = getStepMessage("events", { ...state.data, communicationOther: trimmedText });
      const keyboard = buildEventsKeyboard(state.data.events || []);
      return await sendMessage(chatId, message, {
        reply_markup: keyboard,
        parse_mode: "HTML",
      });
    } else if (waitingFor === "events") {
      // Add "Другое" to events if not already there
      const currentEvents = state.data.events || [];
      if (!currentEvents.includes("Другое")) {
        currentEvents.push("Другое");
      }
      await updateYouthReportData(userId, {
        events: currentEvents,
        eventsOther: trimmedText,
        waitingForOtherText: null,
      });
      await setWaitingForTextInput(userId, true);
      
      // Continue to help
      await updateYouthReportStep(userId, "help");
      const message = getStepMessage("help", { ...state.data, eventsOther: trimmedText });
      const keyboard = buildSkipKeyboard("help");
      return await sendMessage(chatId, message, {
        reply_markup: keyboard,
        parse_mode: "HTML",
      });
    }
  }

  // Handle regular text input
  if (state.step === "help") {
    await updateYouthReportData(userId, { help: trimmedText });
    await updateYouthReportStep(userId, "note");
    await setWaitingForTextInput(userId, true);

    const message = getStepMessage("note", { ...state.data, help: trimmedText });
    const keyboard = buildSkipKeyboard("note");
    return await sendMessage(chatId, message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } else if (state.step === "note") {
    await updateYouthReportData(userId, { note: trimmedText });
    await updateYouthReportStep(userId, "review");
    await setWaitingForTextInput(userId, false);

    const reviewMessage = formatPreviewMessage({ ...state.data, note: trimmedText });
    const keyboard = buildReviewKeyboard();
    return await sendMessage(chatId, reviewMessage, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  }

  return { success: false, error: "Неожиданное состояние формы" };
};

/**
 * Send notification to administrator about youth report
 */
const sendAdminNotification = async (
  type: "success" | "error",
  reportData: {
    leader: string;
    person: string;
    date: Date;
    communicationTypes: string[];
    events: string[];
    help?: string;
    note?: string;
  },
  error?: string
): Promise<void> => {
  try {
    const telegramConfig = getTelegramConfig();
    const adminUsers = telegramConfig.allowedUsers;
    
    if (adminUsers.length === 0) {
      logWarn("No allowed users configured for admin notifications");
      return;
    }
    
    const adminUserId = adminUsers[0];
    let message: string;
    
    if (type === "success") {
      const dateStr = reportData.date.toLocaleDateString("ru-RU", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      
      message = `✅ <b>Новый отчет молодежи заполнен</b>\n\n`;
      message += `👤 <b>Лидер:</b> ${reportData.leader}\n`;
      message += `👥 <b>Человек:</b> ${reportData.person}\n`;
      message += `📅 <b>Дата отчета:</b> ${dateStr}\n\n`;
      message += `💬 <b>Способы общения:</b> ${reportData.communicationTypes.join(", ") || "не указаны"}\n`;
      message += `📅 <b>Мероприятия:</b> ${reportData.events.join(", ") || "не указаны"}\n`;
      if (reportData.help) {
        message += `🆘 <b>Помощь:</b> ${reportData.help}\n`;
      }
      if (reportData.note) {
        message += `📝 <b>Примечание:</b> ${reportData.note}\n`;
      }
    } else {
      const dateStr = reportData.date.toLocaleDateString("ru-RU", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      
      message = `❌ <b>Ошибка при сохранении отчета молодежи</b>\n\n`;
      message += `👤 <b>Лидер:</b> ${reportData.leader}\n`;
      message += `👥 <b>Человек:</b> ${reportData.person}\n`;
      message += `📅 <b>Дата отчета:</b> ${dateStr}\n\n`;
      message += `⚠️ <b>Ошибка:</b> ${error || "Неизвестная ошибка"}\n`;
    }
    
    const result = await sendMessageToUser(adminUserId, message, {
      parse_mode: "HTML",
    });
    
    if (result.success) {
      logInfo("Admin notification sent", {
        type,
        adminUserId,
        person: reportData.person,
        leader: reportData.leader,
      });
    } else {
      logError("Failed to send admin notification", result.error);
    }
  } catch (error) {
    logError("Error sending admin notification", error);
    // Не пробрасываем ошибку, чтобы не прерывать основной поток
  }
};

/**
 * Handle confirmation and save to Notion
 */
const handleConfirm = async (
  userId: number,
  chatId: number,
  state: YouthReportState | undefined
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  // Validate form data
  const validation = validateFormData(state.data);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors.join(", "),
    };
  }

  try {
    // Prepare communication types with "other" text if needed
    let communicationTypes = state.data.communicationTypes || [];
    if (state.data.communicationOther) {
      // Replace "Другое" with the actual text
      communicationTypes = communicationTypes.map((t) =>
        t === "Другое" ? state.data.communicationOther! : t
      );
    }

    // Prepare events with "other" text if needed
    let events = state.data.events || [];
    if (state.data.eventsOther) {
      // Replace "Другое" with the actual text
      events = events.map((e) =>
        e === "Другое" ? state.data.eventsOther! : e
      );
    }

    // Create report input
    const reportInput = {
      person: state.data.person!,
      leader: state.data.leader!,
      date: state.data.date || new Date(),
      communicationTypes,
      events,
      help: state.data.help || "",
      note: state.data.note || "",
    };

    // Save to Notion
    const result = await createYouthReportRecord(reportInput);

    if (result.success) {
      const successMessage = `
✅ <b>Отчет успешно сохранен!</b>

👤 <b>Человек:</b> ${reportInput.person}
💬 <b>Способы общения:</b> ${communicationTypes.join(", ")}
📅 <b>Мероприятия:</b> ${events.join(", ")}
${reportInput.help ? `🆘 <b>Помощь:</b> ${reportInput.help}\n` : ""}
${reportInput.note ? `📝 <b>Примечание:</b> ${reportInput.note}\n` : ""}
Отчет сохранен в базе данных Notion.
`;

      logInfo("Youth report saved successfully", {
        userId,
        chatId,
        person: reportInput.person,
        leader: reportInput.leader,
      });

      // Send notification to admin
      await sendAdminNotification("success", {
        leader: reportInput.leader,
        person: reportInput.person,
        date: reportInput.date,
        communicationTypes,
        events,
        help: reportInput.help,
        note: reportInput.note,
      });

      // Clear state
      await clearYouthReportState(userId);

      return await sendMessage(chatId, successMessage, { parse_mode: "HTML" });
    } else {
      logWarn("Failed to save youth report", { error: result.error });
      
      // Send error notification to admin
      await sendAdminNotification("error", {
        leader: reportInput.leader,
        person: reportInput.person,
        date: reportInput.date,
        communicationTypes,
        events,
        help: reportInput.help,
        note: reportInput.note,
      }, result.error || "Неизвестная ошибка при сохранении в Notion");
      
      return await sendMessage(
        chatId,
        `❌ Ошибка при сохранении отчета: ${result.error}\n\nПопробуйте еще раз или обратитесь к администратору.`
      );
    }
  } catch (error) {
    logError("Error saving youth report", error);
    
    // Send error notification to admin
    const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
    await sendAdminNotification("error", {
      leader: state.data.leader || "неизвестен",
      person: state.data.person || "неизвестен",
      date: state.data.date || new Date(),
      communicationTypes: state.data.communicationTypes || [],
      events: state.data.events || [],
      help: state.data.help,
      note: state.data.note,
    }, errorMessage);
    
    return {
      success: false,
      error: "Произошла ошибка при сохранении отчета",
    };
  }
};

/**
 * Handle cancel
 */
const handleCancel = async (
  userId: number,
  chatId: number,
  _state: YouthReportState | undefined
): Promise<CommandResult> => {
  await clearYouthReportState(userId);
  return await sendMessage(
    chatId,
    "❌ Заполнение отчета отменено.",
    { parse_mode: "HTML" }
  );
};

