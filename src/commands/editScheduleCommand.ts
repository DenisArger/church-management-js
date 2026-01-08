import { CommandResult } from "../types";
import { sendMessage } from "../services/telegramService";
import {
  getUserState,
  initUserState,
  updateStep,
  updateStateData,
  setWaitingForTextInput,
  setMessageId,
  clearUserState,
} from "../utils/scheduleState";
import {
  buildModeKeyboard,
  buildDateKeyboard,
  buildWeekSelectionKeyboard,
  buildWeekPreviewKeyboard,
  buildServiceSelectionKeyboard,
  buildReviewKeyboard,
  buildEditFieldKeyboard,
  buildContinueEditingKeyboard,
  getStepMessage,
  formatWeekPreviewMessage,
  validateFormData,
} from "../utils/scheduleFormBuilder";
import {
  createScheduleService,
  updateScheduleService,
  getScheduleServiceById,
  getScheduleServicesForWeek,
} from "../services/calendarService";
import { logInfo, logError, logWarn } from "../utils/logger";

/**
 * Execute /edit_schedule command
 * Starts the process of editing/creating schedule
 */
export const executeEditScheduleCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult> => {
  logInfo("Executing edit schedule command", { userId, chatId });

  try {
    // Initialize state
    const state = initUserState(userId, chatId);

    // Send initial message with mode selection
    const keyboard = buildModeKeyboard();
    const result = await sendMessage(chatId, getStepMessage("mode", state.data), {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });

    if (result.success && result.data?.messageId) {
      setMessageId(userId, result.data.messageId as number);
    }

    return result;
  } catch (error) {
    logError("Error in edit schedule command", error);
    return {
      success: false,
      error: "Произошла ошибка при запуске редактирования расписания",
    };
  }
};

/**
 * Handle callback query for schedule form
 */
export const handleScheduleCallback = async (
  userId: number,
  chatId: number,
  callbackData: string,
  messageId?: number
): Promise<CommandResult> => {
  logInfo("Handling schedule callback", { userId, callbackData });

  try {
    const state = getUserState(userId);
    if (!state) {
      return {
        success: false,
        error: "Сессия не найдена. Начните заново с команды /edit_schedule",
      };
    }

    // Update message ID if provided
    if (messageId) {
      setMessageId(userId, messageId);
    }

    const parts = callbackData.split(":");
    const action = parts[1];

    switch (action) {
      case "mode":
        return await handleModeSelection(userId, chatId, parts[2], state);
      case "select_week":
        if (parts.length > 2) {
          return await handleWeekSelection(userId, chatId, parts[2], state);
        } else {
          // Show week selection again
          updateStep(userId, "select_week");
          const keyboard = buildWeekSelectionKeyboard();
          return await sendMessage(chatId, getStepMessage("select_week", state.data), {
            reply_markup: keyboard,
            parse_mode: "HTML",
          });
        }
      case "edit_week":
        return await handleEditWeek(userId, chatId, state);
      case "date":
        return await handleDateSelection(userId, chatId, parts[2], state);
      case "select_service":
        return await handleServiceSelection(userId, chatId, parts[2], state);
      case "edit":
        if (parts.length > 2) {
          // Edit specific field
          return await handleEditField(userId, chatId, parts[2], state);
        } else {
          // Show edit menu
          return await handleEdit(userId, chatId, state);
        }
      case "confirm":
        return await handleConfirm(userId, chatId, state);
      case "continue_edit":
        return await handleContinueEdit(userId, chatId, state);
      case "cancel":
        return await handleCancel(userId, chatId, state);
      default:
        logWarn("Unknown schedule callback action", { action, callbackData, parts });
        return { success: false, error: "Неизвестное действие" };
    }
  } catch (error) {
    logError("Error handling schedule callback", error);
    return {
      success: false,
      error: "Произошла ошибка при обработке запроса",
    };
  }
};

/**
 * Handle mode selection (create/edit)
 */
const handleModeSelection = async (
  userId: number,
  chatId: number,
  mode: string,
  state: ReturnType<typeof getUserState>
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  updateStateData(userId, { mode: mode as "create" | "edit" });

  if (mode === "create") {
    updateStep(userId, "date");
    const keyboard = buildDateKeyboard();
    return await sendMessage(chatId, getStepMessage("date", state.data), {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } else {
    // For edit mode, show week selection first
    updateStep(userId, "select_week");
    const keyboard = buildWeekSelectionKeyboard();
    return await sendMessage(chatId, getStepMessage("select_week", state.data), {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  }
};

/**
 * Handle week selection (for edit mode)
 */
const handleWeekSelection = async (
  userId: number,
  chatId: number,
  weekType: string,
  state: ReturnType<typeof getUserState>
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  const week = weekType as "current" | "next";
  updateStateData(userId, { weekType: week });

  // Get all services for the week (not just those with needsMailing)
  const services = await getScheduleServicesForWeek(week);
  
  // Show preview
  updateStep(userId, "preview_week");
  setWaitingForTextInput(userId, false);
  
  const previewMessage = formatWeekPreviewMessage(services, week);
  const keyboard = buildWeekPreviewKeyboard();
  
  return await sendMessage(chatId, previewMessage, {
    reply_markup: keyboard,
    parse_mode: "HTML",
  });
};

/**
 * Handle edit week (show services list after preview)
 */
const handleEditWeek = async (
  userId: number,
  chatId: number,
  state: ReturnType<typeof getUserState>
): Promise<CommandResult> => {
  if (!state || !state.data.weekType) return { success: false, error: "State or week type not found" };

  updateStep(userId, "select_service");
  setWaitingForTextInput(userId, false);
  
  const services = await getScheduleServicesForWeek(state.data.weekType);
  
  if (services.length === 0) {
    const weekName = state.data.weekType === "current" ? "текущей" : "следующей";
    return await sendMessage(
      chatId,
      `❌ Не найдено служений для редактирования на ${weekName} неделю.`,
      { parse_mode: "HTML" }
    );
  }

  const keyboard = buildServiceSelectionKeyboard(services);
  return await sendMessage(chatId, getStepMessage("select_service", state.data), {
    reply_markup: keyboard,
    parse_mode: "HTML",
  });
};

/**
 * Handle date selection
 */
const handleDateSelection = async (
  userId: number,
  chatId: number,
  dateStr: string,
  state: ReturnType<typeof getUserState>
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  const date = new Date(dateStr);
  updateStateData(userId, { date });

  // If editing, return to review; otherwise move to title input
  if (state.data.mode === "edit") {
    updateStep(userId, "review");
    setWaitingForTextInput(userId, false);
    const updatedState = getUserState(userId);
    if (!updatedState) return { success: false, error: "State not found" };
    const reviewMessage = getStepMessage("review", updatedState.data);
    const reviewKeyboard = buildEditFieldKeyboard(updatedState.data);
    return await sendMessage(chatId, reviewMessage, {
      reply_markup: reviewKeyboard,
      parse_mode: "HTML",
    });
  } else {
    // Create mode - move to title input
    updateStep(userId, "title");
    setWaitingForTextInput(userId, true);
    return await sendMessage(chatId, getStepMessage("title", state.data), {
      parse_mode: "HTML",
    });
  }
};

/**
 * Handle service selection (for edit mode)
 */
const handleServiceSelection = async (
  userId: number,
  chatId: number,
  serviceId: string,
  state: ReturnType<typeof getUserState>
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  // Load existing service data
  const service = await getScheduleServiceById(serviceId);
  if (!service) {
    return await sendMessage(
      chatId,
      "❌ Служение не найдено. Попробуйте выбрать другое.",
      { parse_mode: "HTML" }
    );
  }

  updateStateData(userId, {
    serviceId: service.id,
    date: service.date,
    title: service.title,
  });

  // Show preview with edit buttons
  updateStep(userId, "review");
  setWaitingForTextInput(userId, false);
  const updatedState = getUserState(userId);
  if (!updatedState) return { success: false, error: "State not found" };
  const reviewMessage = getStepMessage("review", updatedState.data);
  const reviewKeyboard = buildEditFieldKeyboard(updatedState.data);
  return await sendMessage(chatId, reviewMessage, {
    reply_markup: reviewKeyboard,
    parse_mode: "HTML",
  });
};

/**
 * Handle edit (show field selection)
 */
const handleEdit = async (
  userId: number,
  chatId: number,
  state: ReturnType<typeof getUserState>
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  const keyboard = buildEditFieldKeyboard(state.data);
  return await sendMessage(
    chatId,
    "Выберите поле для редактирования:",
    { reply_markup: keyboard, parse_mode: "HTML" }
  );
};

/**
 * Handle edit specific field
 */
const handleEditField = async (
  userId: number,
  chatId: number,
  fieldName: string,
  state: ReturnType<typeof getUserState>
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  switch (fieldName) {
    case "title":
      updateStep(userId, "title");
      setWaitingForTextInput(userId, true);
      return await sendMessage(chatId, getStepMessage("title", state.data), {
        parse_mode: "HTML",
      });

    case "date":
      updateStep(userId, "date");
      setWaitingForTextInput(userId, false);
      const keyboard = buildDateKeyboard();
      return await sendMessage(chatId, "Выберите новую дату:", {
        reply_markup: keyboard,
        parse_mode: "HTML",
      });

    default:
      return { success: false, error: "Неизвестное поле" };
  }
};

/**
 * Handle text input for fields
 */
export const handleScheduleTextInput = async (
  userId: number,
  chatId: number,
  text: string
): Promise<CommandResult> => {
  logInfo("Handling schedule text input", { userId, text: text.substring(0, 50) });

  try {
    const state = getUserState(userId);
    if (!state || !state.waitingForTextInput) {
      return { success: true, message: "Text input ignored" };
    }

    switch (state.step) {
      case "title":
        updateStateData(userId, { title: text.trim() });
        // Always return to review after editing title
        updateStep(userId, "review");
        setWaitingForTextInput(userId, false);
        const updatedState = getUserState(userId);
        if (!updatedState) return { success: false, error: "State not found" };
        const reviewMessage = getStepMessage("review", updatedState.data);
        const reviewKeyboard = buildEditFieldKeyboard(updatedState.data);
        return await sendMessage(chatId, reviewMessage, {
          reply_markup: reviewKeyboard,
          parse_mode: "HTML",
        });

      default:
        return { success: true };
    }
  } catch (error) {
    logError("Error handling schedule text input", error);
    return {
      success: false,
      error: "Произошла ошибка при обработке ввода",
    };
  }
};

/**
 * Handle confirm and save
 */
const handleConfirm = async (
  userId: number,
  chatId: number,
  state: ReturnType<typeof getUserState>
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  try {
    const validation = validateFormData(state.data);

    if (!validation.valid) {
      return await sendMessage(
        chatId,
        `❌ <b>Ошибки валидации:</b>\n${validation.errors.join("\n")}\n\nПожалуйста, заполните все обязательные поля и попробуйте сохранить снова.`,
        { parse_mode: "HTML" }
      );
    }

    if (state.data.mode === "edit" && state.data.serviceId) {
      const result = await updateScheduleService(
        state.data.serviceId,
        state.data
      );
      if (result.success) {
        // Don't clear state immediately - allow user to continue editing
        const continueKeyboard = buildContinueEditingKeyboard();
        return await sendMessage(
          chatId,
          "✅ Служение успешно обновлено в Notion!",
          { parse_mode: "HTML", reply_markup: continueKeyboard }
        );
      } else {
        clearUserState(userId);
        return await sendMessage(
          chatId,
          `❌ Ошибка при обновлении служения:\n${result.error || "Неизвестная ошибка"}\n\nПопробуйте заполнить заново.`,
          { parse_mode: "HTML" }
        );
      }
    } else {
      const result = await createScheduleService(state.data);
      if (result.success) {
        // Save serviceId and switch to edit mode for future updates
        const pageId = result.data?.pageId as string | undefined;
        if (pageId) {
          updateStateData(userId, {
            serviceId: pageId,
            mode: "edit",
          });
        }
        // Don't clear state immediately - allow user to continue editing
        const continueKeyboard = buildContinueEditingKeyboard();
        return await sendMessage(
          chatId,
          "✅ Служение успешно сохранено в Notion!",
          { parse_mode: "HTML", reply_markup: continueKeyboard }
        );
      } else {
        clearUserState(userId);
        return await sendMessage(
          chatId,
          `❌ Ошибка при сохранении служения:\n${result.error || "Неизвестная ошибка"}\n\nПопробуйте заполнить заново.`,
          { parse_mode: "HTML" }
        );
      }
    }
  } catch (error) {
    logError("Error confirming schedule", error);
    clearUserState(userId);
    const errorMessage =
      error instanceof Error ? error.message : "Неизвестная ошибка";
    return await sendMessage(
      chatId,
      `❌ Произошла ошибка при сохранении служения:\n${errorMessage}\n\nПопробуйте заполнить заново.`,
      { parse_mode: "HTML" }
    );
  }
};

/**
 * Handle continue editing after successful save
 */
const handleContinueEdit = async (
  userId: number,
  chatId: number,
  state: ReturnType<typeof getUserState>
): Promise<CommandResult> => {
  if (!state) {
    return {
      success: false,
      error: "Сессия не найдена. Начните заново с команды /edit_schedule",
    };
  }

  // Return to review step with edit keyboard
  updateStep(userId, "review");
  setWaitingForTextInput(userId, false);
  const reviewMessage = getStepMessage("review", state.data);
  const reviewKeyboard = buildEditFieldKeyboard(state.data);
  return await sendMessage(chatId, reviewMessage, {
    reply_markup: reviewKeyboard,
    parse_mode: "HTML",
  });
};

/**
 * Handle cancel
 */
const handleCancel = async (
  userId: number,
  chatId: number,
  state: ReturnType<typeof getUserState>
): Promise<CommandResult> => {
  clearUserState(userId);
  return await sendMessage(
    chatId,
    "❌ Редактирование расписания отменено.\n\nВсе несохраненные данные удалены. Вы можете начать заново с команды /edit_schedule",
    { parse_mode: "HTML" }
  );
};

