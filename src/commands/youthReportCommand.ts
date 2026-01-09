import { CommandResult } from "../types";
import { sendMessage, answerCallbackQuery } from "../services/telegramService";
import { 
  createYouthReportRecord, 
  getYouthPeopleForLeader,
  getLeaderByTelegramId 
} from "../services/notionService";
import { logInfo, logWarn, logError } from "../utils/logger";
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
  getStepMessage,
  getPersonByIndex,
  formatPreviewMessage,
  validateFormData,
  COMMUNICATION_TYPES,
  EVENT_TYPES,
} from "../utils/youthReportFormBuilder";

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
  if (hasActiveYouthReportState(userId)) {
    // Handle text input
    return await handleYouthReportTextInput(userId, chatId, params.join(" "));
  }

  // No active state - start interactive form
  try {
    // Get leader name by Telegram ID
    const leader = await getLeaderByTelegramId(userId);
    if (!leader) {
      return {
        success: false,
        error: "Не удалось определить лидера. Обратитесь к администратору.",
      };
    }

    // Initialize state
    const state = initYouthReportState(userId, chatId, leader);

    // Get list of people for this leader
    const people = await getYouthPeopleForLeader(leader);
    if (people.length === 0) {
      return {
        success: false,
        error: "Не найдены люди, закрепленные за вами. Обратитесь к администратору.",
      };
    }

    // Store people list in state for callback data decoding
    updateYouthReportData(userId, { peopleList: people });

    // Send initial message with person selection
    const keyboard = buildPersonSelectionKeyboard(people);
    const message = getStepMessage("person", state.data);
    const result = await sendMessage(chatId, message, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });

    if (result.success && result.data?.messageId) {
      setMessageId(userId, result.data.messageId as number);
    }

    return result;
  } catch (error) {
    logError("Error in youth report command", error);
    return {
      success: false,
      error: "Произошла ошибка при запуске формы отчета",
    };
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
    const state = getYouthReportState(userId);
    if (!state) {
      return {
        success: false,
        error: "Сессия не найдена. Начните заново с команды /youth_report",
      };
    }

    // Update message ID if provided
    if (messageId) {
      setMessageId(userId, messageId);
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
  state: ReturnType<typeof getYouthReportState>
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
    updateYouthReportData(userId, { person: personName });
    updateYouthReportStep(userId, "communication");
    setWaitingForTextInput(userId, false);

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
  state: ReturnType<typeof getYouthReportState>
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
    
    updateYouthReportStep(userId, "events");
    setWaitingForTextInput(userId, false);

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
      updateYouthReportData(userId, { waitingForOtherText: "communication" });
      setWaitingForTextInput(userId, true);
      
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

    updateYouthReportData(userId, { communicationTypes: newTypes });

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
  state: ReturnType<typeof getYouthReportState>
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  const parts = callbackData.split(":");
  
  // Handle "done" action
  if (parts[2] === "done") {
    // User clicked "Готово"
    updateYouthReportStep(userId, "help");
    setWaitingForTextInput(userId, true);

    const message = getStepMessage("help", state.data);
    
    return await sendMessage(chatId, message, {
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
      updateYouthReportData(userId, { waitingForOtherText: "events" });
      setWaitingForTextInput(userId, true);
      
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

    updateYouthReportData(userId, { events: newEvents });

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
  state: ReturnType<typeof getYouthReportState>
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
      updateYouthReportData(userId, { peopleList: people });
      updateYouthReportStep(userId, "person");
      const personKeyboard = buildPersonSelectionKeyboard(people);
      const personMessage = getStepMessage("person", state.data);
      return await sendMessage(chatId, personMessage, {
        reply_markup: personKeyboard,
        parse_mode: "HTML",
      });

    case "communication":
      updateYouthReportStep(userId, "communication");
      setWaitingForTextInput(userId, false);
      const commMessage = getStepMessage("communication", state.data);
      const commKeyboard = buildCommunicationKeyboard(state.data.communicationTypes || []);
      return await sendMessage(chatId, commMessage, {
        reply_markup: commKeyboard,
        parse_mode: "HTML",
      });

    case "events":
      updateYouthReportStep(userId, "events");
      setWaitingForTextInput(userId, false);
      const eventsMessage = getStepMessage("events", state.data);
      const eventsKeyboard = buildEventsKeyboard(state.data.events || []);
      return await sendMessage(chatId, eventsMessage, {
        reply_markup: eventsKeyboard,
        parse_mode: "HTML",
      });

    case "help":
      updateYouthReportStep(userId, "help");
      setWaitingForTextInput(userId, true);
      const helpMessage = getStepMessage("help", state.data);
      return await sendMessage(chatId, helpMessage, {
        parse_mode: "HTML",
      });

    case "note":
      updateYouthReportStep(userId, "note");
      setWaitingForTextInput(userId, true);
      const noteMessage = getStepMessage("note", state.data);
      return await sendMessage(chatId, noteMessage, {
        parse_mode: "HTML",
      });

    default:
      return { success: false, error: "Неизвестное поле для редактирования" };
  }
};

/**
 * Handle text input for youth report form
 */
const handleYouthReportTextInput = async (
  userId: number,
  chatId: number,
  text: string
): Promise<CommandResult> => {
  const state = getYouthReportState(userId);
  if (!state) {
    return {
      success: false,
      error: "Сессия не найдена. Начните заново с команды /youth_report",
    };
  }

  if (!text || text.trim().length === 0) {
    // Allow empty text for optional fields
    if (state.step === "help" || state.step === "note") {
      // Skip optional fields
      if (state.step === "help") {
        updateYouthReportData(userId, { help: "" });
        updateYouthReportStep(userId, "note");
        setWaitingForTextInput(userId, true);
        const message = getStepMessage("note", state.data);
        return await sendMessage(chatId, message, {
          parse_mode: "HTML",
        });
      } else if (state.step === "note") {
        updateYouthReportData(userId, { note: "" });
        updateYouthReportStep(userId, "review");
        setWaitingForTextInput(userId, false);
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

  const trimmedText = text.trim();

  // Check if we're waiting for "other" text
  if (state.data.waitingForOtherText) {
    const waitingFor = state.data.waitingForOtherText;
    
    if (waitingFor === "communication") {
      // Add "Другое" to communication types if not already there
      const currentTypes = state.data.communicationTypes || [];
      if (!currentTypes.includes("Другое")) {
        currentTypes.push("Другое");
      }
      updateYouthReportData(userId, {
        communicationTypes: currentTypes,
        communicationOther: trimmedText,
        waitingForOtherText: null,
      });
      setWaitingForTextInput(userId, false);
      
      // Continue to events
      updateYouthReportStep(userId, "events");
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
      updateYouthReportData(userId, {
        events: currentEvents,
        eventsOther: trimmedText,
        waitingForOtherText: null,
      });
      setWaitingForTextInput(userId, true);
      
      // Continue to help
      updateYouthReportStep(userId, "help");
      const message = getStepMessage("help", { ...state.data, eventsOther: trimmedText });
      return await sendMessage(chatId, message, {
        parse_mode: "HTML",
      });
    }
  }

  // Handle regular text input
  if (state.step === "help") {
    updateYouthReportData(userId, { help: trimmedText });
    updateYouthReportStep(userId, "note");
    setWaitingForTextInput(userId, true);

    const message = getStepMessage("note", { ...state.data, help: trimmedText });
    return await sendMessage(chatId, message, {
      parse_mode: "HTML",
    });
  } else if (state.step === "note") {
    updateYouthReportData(userId, { note: trimmedText });
    updateYouthReportStep(userId, "review");
    setWaitingForTextInput(userId, false);

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
 * Handle confirmation and save to Notion
 */
const handleConfirm = async (
  userId: number,
  chatId: number,
  state: ReturnType<typeof getYouthReportState>
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

      // Clear state
      clearYouthReportState(userId);

      return await sendMessage(chatId, successMessage, { parse_mode: "HTML" });
    } else {
      logWarn("Failed to save youth report", { error: result.error });
      return await sendMessage(
        chatId,
        `❌ Ошибка при сохранении отчета: ${result.error}\n\nПопробуйте еще раз или обратитесь к администратору.`
      );
    }
  } catch (error) {
    logError("Error saving youth report", error);
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
  state: ReturnType<typeof getYouthReportState>
): Promise<CommandResult> => {
  clearYouthReportState(userId);
  return await sendMessage(
    chatId,
    "❌ Заполнение отчета отменено.",
    { parse_mode: "HTML" }
  );
};

