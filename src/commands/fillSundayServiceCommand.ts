import { CommandResult, SundayServiceState } from "../types";
import { sendMessage } from "../services/telegramService";
import {
  getUserState,
  initUserState,
  updateStep,
  updateStateData,
  setWaitingForTextInput,
  setMessageId,
  clearUserState,
  saveCurrentStreamData,
  loadCurrentStreamData,
  getCurrentStream,
} from "../utils/sundayServiceState";
import {
  buildModeKeyboard,
  buildStreamKeyboard,
  buildDateKeyboard,
  buildPreachersKeyboard,
  buildWorshipServiceKeyboard,
  buildYesNoKeyboard,
  buildNumberKeyboard,
  buildScriptureReaderKeyboard,
  buildReviewKeyboard,
  buildEditFieldKeyboard,
  buildContinueEditingKeyboard,
  getStepMessage,
  validateFormData,
} from "../utils/sundayServiceFormBuilder";
import {
  createSundayService,
  updateSundayService,
  getSundayServiceByDate,
  getWorshipServices,
  getScriptureReaders,
} from "../services/calendarService";
import { logInfo, logError, logWarn } from "../utils/logger";
/**
 * Execute /fill_sunday_service command
 * Starts the process of filling Sunday service information
 */
export const executeFillSundayServiceCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult> => {
  logInfo("Executing fill Sunday service command", { userId, chatId });

  try {
    // Initialize state
    const state = await initUserState(userId, chatId);

    // Send initial message with mode selection
    const keyboard = buildModeKeyboard();
    const result = await sendMessage(chatId, getStepMessage("mode", state.data), {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });

    if (result.success && result.data?.messageId) {
      await setMessageId(userId, result.data.messageId as number);
    }

    return result;
  } catch (error) {
    logError("Error in fill Sunday service command", error);
    return {
      success: false,
      error: "Произошла ошибка при запуске заполнения воскресного служения",
    };
  }
};

/**
 * Handle callback query for Sunday service form
 */
export const handleSundayServiceCallback = async (
  userId: number,
  chatId: number,
  callbackData: string,
  messageId?: number
): Promise<CommandResult> => {
  logInfo("Handling Sunday service callback", { userId, callbackData });

  try {
    const state = await getUserState(userId);
    if (!state) {
      return {
        success: false,
        error: "Сессия не найдена. Начните заново с команды /fill_sunday_service",
      };
    }

    // Update message ID if provided
    if (messageId) {
      await setMessageId(userId, messageId);
    }

  const parts = callbackData.split(":");
  const action = parts[1];

  switch (action) {
    case "mode":
      return await handleModeSelection(userId, chatId, parts[2], state);
    case "date":
      return await handleDateSelection(userId, chatId, parts[2], state);
    case "stream":
      return await handleStreamSelection(userId, chatId, parts[2], state);
    case "field":
      return await handleFieldSelection(userId, chatId, callbackData, state);
    case "confirm":
      return await handleConfirm(userId, chatId, state);
    case "edit":
      if (parts.length > 2) {
        // Edit specific field
        return await handleEditField(userId, chatId, parts[2], state);
      } else {
        // Show edit menu
        return await handleEdit(userId, chatId, state);
      }
    case "continue_edit":
      return await handleContinueEdit(userId, chatId, state);
    case "cancel":
      return await handleCancel(userId, chatId, state);
    default:
      logWarn("Unknown Sunday service callback action", { action, callbackData, parts });
      return { success: false, error: "Неизвестное действие" };
  }
  } catch (error) {
    logError("Error handling Sunday service callback", error);
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
  state: SundayServiceState | undefined
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  await updateStateData(userId, { mode: mode as "create" | "edit" });

  if (mode === "create") {
    await updateStep(userId, "date");
    const keyboard = buildDateKeyboard();
    return await sendMessage(chatId, getStepMessage("date", state.data), {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } else {
    // For edit mode, we need to show available dates
    // For now, we'll use the same date selection
    await updateStep(userId, "date");
    const keyboard = buildDateKeyboard();
    return await sendMessage(chatId, "Выберите дату служения для редактирования:", {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  }
};

/**
 * Handle date selection
 */
const handleDateSelection = async (
  userId: number,
  chatId: number,
  dateStr: string,
  state: SundayServiceState | undefined
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  const date = new Date(dateStr);
  await updateStateData(userId, { date });

  // If edit mode, try to load existing service
  if (state.data.mode === "edit") {
    // We'll need to ask for stream first to load the right service
    await updateStep(userId, "stream");
    const keyboard = buildStreamKeyboard();
    return await sendMessage(chatId, getStepMessage("stream", state.data), {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } else {
    // Create mode - ask for stream
    await updateStep(userId, "stream");
    const keyboard = buildStreamKeyboard();
    return await sendMessage(chatId, getStepMessage("stream", state.data), {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  }
};

/**
 * Handle stream selection
 */
const handleStreamSelection = async (
  userId: number,
  chatId: number,
  stream: string,
  state: SundayServiceState | undefined
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  await updateStateData(userId, { stream: stream as "1" | "2" | "both" });

  // If edit mode, try to load existing service
  if (state.data.mode === "edit" && state.data.date) {
    const streamType = stream === "both" ? "1" : (stream as "1" | "2");
    const existingService = await getSundayServiceByDate(
      state.data.date,
      streamType
    );

    if (existingService) {
      // Load existing data
      await updateStateData(userId, {
        serviceId: existingService.id,
        title: existingService.title,
        preachers: existingService.preachers.map((p) => p.name),
        worshipService: existingService.worshipService,
        songBeforeStart: existingService.songBeforeStart,
        numWorshipSongs: existingService.numWorshipSongs,
        soloSong: existingService.soloSong,
        repentanceSong: existingService.repentanceSong,
        scriptureReading: existingService.scriptureReading,
        scriptureReader: existingService.scriptureReader,
      });
    }
  }

  // If both streams, set current stream to 1
  if (stream === "both") {
    await updateStateData(userId, { currentStream: "1" });
  }

  // Generate default title if not set
  if (!state.data.title && state.data.date) {
    const streamName = stream === "1" ? "I поток" : stream === "2" ? "II поток" : "I поток";
    const dateStr = new Date(state.data.date).toLocaleDateString("ru-RU");
    await updateStateData(userId, {
      title: `Воскресное служение ${streamName} - ${dateStr}`,
    });
  }

  // Show preview with edit buttons immediately
  await updateStep(userId, "review");
  await setWaitingForTextInput(userId, false);
  const updatedState = await getUserState(userId);
  if (!updatedState) return { success: false, error: "State not found" };
  const reviewMessage = getStepMessage("review", updatedState.data);
  const reviewKeyboard = buildEditFieldKeyboard(updatedState.data);
  return await sendMessage(chatId, reviewMessage, {
    reply_markup: reviewKeyboard,
    parse_mode: "HTML",
  });
};

/**
 * Handle field selection
 */
const handleFieldSelection = async (
  userId: number,
  chatId: number,
  callbackData: string,
  state: SundayServiceState | undefined
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  const parts = callbackData.split(":");
  const fieldName = parts[2];
  // Join all parts after field name to handle values with colons
  const value = parts.slice(3).join(":");
  
  logInfo("Handling field selection", {
    callbackData,
    parts,
    fieldName,
    value,
    partsLength: parts.length,
  });

  switch (fieldName) {
    case "preacher":
      if (value === "custom") {
        await setWaitingForTextInput(userId, true);
        return await sendMessage(
          chatId,
          "Введите имя проповедника:",
          { parse_mode: "HTML" }
        );
      } else {
        // Toggle preacher selection
        const currentPreachers = state.data.preachers || [];
        const index = currentPreachers.indexOf(value);
        if (index >= 0) {
          currentPreachers.splice(index, 1);
        } else {
          currentPreachers.push(value);
        }
        await updateStateData(userId, { preachers: [...currentPreachers] });

        const currentPage = state.data.preachersPage || 1;
        const keyboard = buildPreachersKeyboard(currentPreachers, currentPage);
        return await sendMessage(
          chatId,
          getStepMessage("preachers", { ...state.data, preachers: currentPreachers }),
          { reply_markup: keyboard, parse_mode: "HTML" }
        );
      }

    case "preachers":
      if (value === "done") {
        // If editing, return to review
        if (state.step === "preachers" && state.data.mode === "edit") {
          await updateStep(userId, "review");
          await setWaitingForTextInput(userId, false);
          const updatedState = await getUserState(userId);
          if (!updatedState) return { success: false, error: "State not found" };
          const reviewMessage = getStepMessage("review", updatedState.data);
          const reviewKeyboard = buildEditFieldKeyboard(updatedState.data);
          return await sendMessage(chatId, reviewMessage, {
            reply_markup: reviewKeyboard,
            parse_mode: "HTML",
          });
        }
        // Otherwise continue normal flow
        await updateStep(userId, "worshipService");
        await setWaitingForTextInput(userId, false);
        const worshipServices = await getWorshipServices();
        // Store worship services list in state for callback data lookup
        await updateStateData(userId, { worshipServicesList: worshipServices });
        const keyboard = buildWorshipServiceKeyboard(worshipServices);
        return await sendMessage(
          chatId,
          getStepMessage("worshipService", state.data),
          { reply_markup: keyboard, parse_mode: "HTML" }
        );
      } else if (value.startsWith("page:")) {
        // Handle pagination
        const page = parseInt(value.split(":")[1], 10);
        await updateStateData(userId, { preachersPage: page });
        const currentPreachers = state.data.preachers || [];
        const keyboard = buildPreachersKeyboard(currentPreachers, page);
        return await sendMessage(
          chatId,
          getStepMessage("preachers", { ...state.data, preachers: currentPreachers }),
          { reply_markup: keyboard, parse_mode: "HTML" }
        );
      }
      break;

    case "worshipService":
      if (value === "custom") {
        await setWaitingForTextInput(userId, true);
        return await sendMessage(
          chatId,
          "Введите название музыкального служения:",
          { parse_mode: "HTML" }
        );
      } else if (value.startsWith("idx:")) {
        // Handle index-based callback data
        // Value format: "idx:4", so split by ":" and get second part
        const indexStr = value.split(":")[1];
        const index = parseInt(indexStr, 10);
        
        logInfo("Parsing worship service index", {
          value,
          indexStr,
          index,
          isNaN: isNaN(index),
        });
        
        if (isNaN(index)) {
          logWarn("Invalid index format", { value, indexStr, index });
          return { success: false, error: "Invalid worship service index format" };
        }
        
        // Get fresh state to ensure we have the latest worshipServicesList
        const currentState = await getUserState(userId);
        if (!currentState) return { success: false, error: "State not found" };
        const worshipServices = currentState.data.worshipServicesList || [];
        
        if (worshipServices.length === 0) {
          // If list is empty, reload it
          const reloadedServices = await getWorshipServices();
          await updateStateData(userId, { worshipServicesList: reloadedServices });
          if (index >= 0 && index < reloadedServices.length) {
            const selectedService = reloadedServices[index];
            await updateStateData(userId, { worshipService: selectedService });
          } else {
            logWarn("Invalid worship service index after reload", {
              index,
              listLength: reloadedServices.length,
            });
            return { success: false, error: "Invalid worship service index" };
          }
        } else if (index >= 0 && index < worshipServices.length) {
          const selectedService = worshipServices[index];
          logInfo("Selected worship service", { index, service: selectedService });
          await updateStateData(userId, { worshipService: selectedService });
        } else {
          logWarn("Invalid worship service index", {
            index,
            listLength: worshipServices.length,
            worshipServices,
          });
          return { success: false, error: "Invalid worship service index" };
        }
        
        // Get updated state after setting worshipService
        const updatedState = await getUserState(userId);
        if (!updatedState) return { success: false, error: "State not found" };
        
        // If editing, return to review
        if (currentState.step === "worshipService" && currentState.data.mode === "edit") {
          await updateStep(userId, "review");
          await setWaitingForTextInput(userId, false);
          const reviewMessage = getStepMessage("review", updatedState.data);
          const reviewKeyboard = buildEditFieldKeyboard(updatedState.data);
          return await sendMessage(chatId, reviewMessage, {
            reply_markup: reviewKeyboard,
            parse_mode: "HTML",
          });
        }
        // Otherwise continue normal flow
        await updateStep(userId, "songBeforeStart");
        const keyboard = buildYesNoKeyboard("songBeforeStart", updatedState.data.songBeforeStart);
        return await sendMessage(
          chatId,
          getStepMessage("songBeforeStart", updatedState.data),
          { reply_markup: keyboard, parse_mode: "HTML" }
        );
      } else {
        // Fallback for direct value (shouldn't happen with new implementation)
        await updateStateData(userId, { worshipService: value });
        // If editing, return to review
        if (state.step === "worshipService" && state.data.mode === "edit") {
          await updateStep(userId, "review");
          await setWaitingForTextInput(userId, false);
          const updatedState = await getUserState(userId);
          if (!updatedState) return { success: false, error: "State not found" };
          const reviewMessage = getStepMessage("review", updatedState.data);
          const reviewKeyboard = buildEditFieldKeyboard(updatedState.data);
          return await sendMessage(chatId, reviewMessage, {
            reply_markup: reviewKeyboard,
            parse_mode: "HTML",
          });
        }
        // Otherwise continue normal flow
        await updateStep(userId, "songBeforeStart");
        const keyboard = buildYesNoKeyboard("songBeforeStart", state.data.songBeforeStart);
        return await sendMessage(
          chatId,
          getStepMessage("songBeforeStart", state.data),
          { reply_markup: keyboard, parse_mode: "HTML" }
        );
      }

    case "songBeforeStart":
      await updateStateData(userId, { songBeforeStart: value === "true" });
      // If editing, return to review
      if (state.step === "songBeforeStart" && state.data.mode === "edit") {
        await updateStep(userId, "review");
        await setWaitingForTextInput(userId, false);
        const updatedState = await getUserState(userId);
        if (!updatedState) return { success: false, error: "State not found" };
        const reviewMessage = getStepMessage("review", updatedState.data);
        const reviewKeyboard = buildReviewKeyboard();
        return await sendMessage(chatId, reviewMessage, {
          reply_markup: reviewKeyboard,
          parse_mode: "HTML",
        });
      }
      // Otherwise continue normal flow
      await updateStep(userId, "numWorshipSongs");
      const numKeyboard = buildNumberKeyboard("numWorshipSongs", state.data.numWorshipSongs);
      return await sendMessage(
        chatId,
        getStepMessage("numWorshipSongs", state.data),
        { reply_markup: numKeyboard, parse_mode: "HTML" }
      );

    case "numWorshipSongs":
      if (value === "custom") {
        await setWaitingForTextInput(userId, true);
        return await sendMessage(
          chatId,
          "Введите количество песен (число):",
          { parse_mode: "HTML" }
        );
      } else {
        await updateStateData(userId, { numWorshipSongs: parseInt(value, 10) });
        // If editing, return to review
        if (state.step === "numWorshipSongs" && state.data.mode === "edit") {
          await updateStep(userId, "review");
          await setWaitingForTextInput(userId, false);
          const updatedState = await getUserState(userId);
          if (!updatedState) return { success: false, error: "State not found" };
          const reviewMessage = getStepMessage("review", updatedState.data);
        const reviewKeyboard = buildEditFieldKeyboard(updatedState.data);
        return await sendMessage(chatId, reviewMessage, {
          reply_markup: reviewKeyboard,
          parse_mode: "HTML",
        });
      }
      // Otherwise continue normal flow
      await updateStep(userId, "soloSong");
        const soloKeyboard = buildYesNoKeyboard("soloSong", state.data.soloSong);
        return await sendMessage(
          chatId,
          getStepMessage("soloSong", state.data),
          { reply_markup: soloKeyboard, parse_mode: "HTML" }
        );
      }

    case "soloSong":
      await updateStateData(userId, { soloSong: value === "true" });
      // If editing, return to review
      if (state.step === "soloSong" && state.data.mode === "edit") {
        await updateStep(userId, "review");
        await setWaitingForTextInput(userId, false);
        const updatedState = await getUserState(userId);
        if (!updatedState) return { success: false, error: "State not found" };
        const reviewMessage = getStepMessage("review", updatedState.data);
        const reviewKeyboard = buildEditFieldKeyboard(updatedState.data);
        return await sendMessage(chatId, reviewMessage, {
          reply_markup: reviewKeyboard,
          parse_mode: "HTML",
        });
      }
      // Otherwise continue normal flow
      await updateStep(userId, "repentanceSong");
      const repentanceKeyboard = buildYesNoKeyboard("repentanceSong", state.data.repentanceSong);
      return await sendMessage(
        chatId,
        getStepMessage("repentanceSong", state.data),
        { reply_markup: repentanceKeyboard, parse_mode: "HTML" }
      );

    case "repentanceSong":
      await updateStateData(userId, { repentanceSong: value === "true" });
      // If editing, return to review
      if (state.step === "repentanceSong" && state.data.mode === "edit") {
        await updateStep(userId, "review");
        await setWaitingForTextInput(userId, false);
        const updatedState = await getUserState(userId);
        if (!updatedState) return { success: false, error: "State not found" };
        const reviewMessage = getStepMessage("review", updatedState.data);
        const reviewKeyboard = buildReviewKeyboard();
        return await sendMessage(chatId, reviewMessage, {
          reply_markup: reviewKeyboard,
          parse_mode: "HTML",
        });
      }
      // Otherwise continue normal flow
      await updateStep(userId, "scriptureReading");
      await setWaitingForTextInput(userId, true);
      return await sendMessage(
        chatId,
        getStepMessage("scriptureReading", state.data),
        { parse_mode: "HTML" }
      );

    case "scriptureReader":
      if (value === "custom") {
        await setWaitingForTextInput(userId, true);
        return await sendMessage(
          chatId,
          "Введите имя чтеца Писания:",
          { parse_mode: "HTML" }
        );
      } else if (value.startsWith("idx:")) {
        // Handle index-based callback data
        const indexStr = value.split(":")[1];
        const index = parseInt(indexStr, 10);
        
        logInfo("Parsing scripture reader index", {
          value,
          indexStr,
          index,
          isNaN: isNaN(index),
        });
        
        if (isNaN(index)) {
          logWarn("Invalid index format", { value, indexStr, index });
          return { success: false, error: "Invalid scripture reader index format" };
        }
        
        // Get fresh state to ensure we have the latest scriptureReadersList
        const currentState = await getUserState(userId);
        if (!currentState) return { success: false, error: "State not found" };
        const scriptureReaders = currentState.data.scriptureReadersList || [];
        
        if (scriptureReaders.length === 0) {
          // If list is empty, reload it
          const reloadedReaders = await getScriptureReaders();
          await updateStateData(userId, { scriptureReadersList: reloadedReaders });
          if (index >= 0 && index < reloadedReaders.length) {
            const selectedReader = reloadedReaders[index];
            await updateStateData(userId, { scriptureReader: selectedReader });
          } else {
            logWarn("Invalid scripture reader index after reload", {
              index,
              listLength: reloadedReaders.length,
            });
            return { success: false, error: "Invalid scripture reader index" };
          }
        } else if (index >= 0 && index < scriptureReaders.length) {
          const selectedReader = scriptureReaders[index];
          logInfo("Selected scripture reader", { index, reader: selectedReader });
          await updateStateData(userId, { scriptureReader: selectedReader });
        } else {
          logWarn("Invalid scripture reader index", {
            index,
            listLength: scriptureReaders.length,
            scriptureReaders,
          });
          return { success: false, error: "Invalid scripture reader index" };
        }
        
        // Get updated state after setting scriptureReader
        const updatedState = await getUserState(userId);
        if (!updatedState) return { success: false, error: "State not found" };
        
        // If editing, return to review
        if (currentState.step === "scriptureReader" && currentState.data.mode === "edit") {
          await updateStep(userId, "review");
          await setWaitingForTextInput(userId, false);
          const reviewMessage = getStepMessage("review", updatedState.data);
          const reviewKeyboard = buildReviewKeyboard();
          return await sendMessage(chatId, reviewMessage, {
            reply_markup: reviewKeyboard,
            parse_mode: "HTML",
          });
        }
        // Move to review or next stream
        return await proceedToReviewOrNextStream(userId, chatId, updatedState);
      } else {
        // Fallback for direct value (shouldn't happen with new implementation)
        await updateStateData(userId, { scriptureReader: value });
        // If editing, return to review
        if (state.step === "scriptureReader" && state.data.mode === "edit") {
          await updateStep(userId, "review");
          await setWaitingForTextInput(userId, false);
          const updatedState = await getUserState(userId);
          if (!updatedState) return { success: false, error: "State not found" };
          const reviewMessage = getStepMessage("review", updatedState.data);
          const reviewKeyboard = buildReviewKeyboard();
          return await sendMessage(chatId, reviewMessage, {
            reply_markup: reviewKeyboard,
            parse_mode: "HTML",
          });
        }
        // Move to review or next stream
        return await proceedToReviewOrNextStream(userId, chatId, state);
      }
  }

  return { success: true };
};

/**
 * Handle text input for fields
 */
export const handleSundayServiceTextInput = async (
  userId: number,
  chatId: number,
  text: string
): Promise<CommandResult> => {
  logInfo("Handling Sunday service text input", { userId, text: text.substring(0, 50) });

  try {
    const state = await getUserState(userId);
    if (!state || !state.waitingForTextInput) {
      return { success: true, message: "Text input ignored" };
    }

    switch (state.step) {
      case "title":
        await updateStateData(userId, { title: text.trim() });
        // Always return to review after editing title
        await updateStep(userId, "review");
        await setWaitingForTextInput(userId, false);
        const updatedState = await getUserState(userId);
        if (!updatedState) return { success: false, error: "State not found" };
        const reviewMessage = getStepMessage("review", updatedState.data);
        const reviewKeyboard = buildEditFieldKeyboard(updatedState.data);
        return await sendMessage(chatId, reviewMessage, {
          reply_markup: reviewKeyboard,
          parse_mode: "HTML",
        });

      case "preachers":
        // Custom preacher name
        const currentPreachers = state.data.preachers || [];
        currentPreachers.push(text.trim());
        await updateStateData(userId, { preachers: currentPreachers });
        const preachersPage = state.data.preachersPage || 1;
        const updatedPreachersKeyboard = buildPreachersKeyboard(currentPreachers, preachersPage);
        return await sendMessage(
          chatId,
          getStepMessage("preachers", { ...state.data, preachers: currentPreachers }),
          { reply_markup: updatedPreachersKeyboard, parse_mode: "HTML" }
        );

      case "worshipService":
        await updateStateData(userId, { worshipService: text.trim() });
        // If editing, return to review
        if (state.step === "worshipService" && state.data.mode === "edit") {
          await updateStep(userId, "review");
          await setWaitingForTextInput(userId, false);
          const updatedState = await getUserState(userId);
          if (!updatedState) return { success: false, error: "State not found" };
          const reviewMessage = getStepMessage("review", updatedState.data);
        const reviewKeyboard = buildEditFieldKeyboard(updatedState.data);
        return await sendMessage(chatId, reviewMessage, {
          reply_markup: reviewKeyboard,
          parse_mode: "HTML",
        });
      }
      // Otherwise continue normal flow
      await updateStep(userId, "songBeforeStart");
        await setWaitingForTextInput(userId, false);
        const songKeyboard = buildYesNoKeyboard("songBeforeStart", state.data.songBeforeStart);
        return await sendMessage(
          chatId,
          getStepMessage("songBeforeStart", { ...state.data, worshipService: text.trim() }),
          { reply_markup: songKeyboard, parse_mode: "HTML" }
        );

      case "numWorshipSongs":
        const num = parseInt(text.trim(), 10);
        if (isNaN(num) || num < 1) {
          return await sendMessage(
            chatId,
            "Пожалуйста, введите корректное число (больше 0):",
            { parse_mode: "HTML" }
          );
        }
        await updateStateData(userId, { numWorshipSongs: num });
        // If editing, return to review
        if (state.step === "numWorshipSongs" && state.data.mode === "edit") {
          await updateStep(userId, "review");
          await setWaitingForTextInput(userId, false);
          const updatedState = await getUserState(userId);
          if (!updatedState) return { success: false, error: "State not found" };
          const reviewMessage = getStepMessage("review", updatedState.data);
        const reviewKeyboard = buildEditFieldKeyboard(updatedState.data);
        return await sendMessage(chatId, reviewMessage, {
          reply_markup: reviewKeyboard,
          parse_mode: "HTML",
        });
      }
      // Otherwise continue normal flow
      await updateStep(userId, "soloSong");
        await setWaitingForTextInput(userId, false);
        const soloKeyboard = buildYesNoKeyboard("soloSong", state.data.soloSong);
        return await sendMessage(
          chatId,
          getStepMessage("soloSong", { ...state.data, numWorshipSongs: num }),
          { reply_markup: soloKeyboard, parse_mode: "HTML" }
        );

      case "scriptureReading":
        await updateStateData(userId, { scriptureReading: text.trim() });
        // If we're in review mode (editing), return to review
        if (state.step === "scriptureReading" && state.data.mode === "edit") {
          await updateStep(userId, "review");
          await setWaitingForTextInput(userId, false);
          const updatedState = await getUserState(userId);
          if (!updatedState) return { success: false, error: "State not found" };
          const reviewMessage = getStepMessage("review", updatedState.data);
          const reviewKeyboard = buildReviewKeyboard();
          return await sendMessage(chatId, reviewMessage, {
            reply_markup: reviewKeyboard,
            parse_mode: "HTML",
          });
        }
        // Otherwise continue normal flow
        await updateStep(userId, "scriptureReader");
        await setWaitingForTextInput(userId, false);
        const scriptureReaders = await getScriptureReaders();
        // Store scripture readers list in state for callback data lookup
        await updateStateData(userId, { scriptureReadersList: scriptureReaders });
        const readerKeyboard = buildScriptureReaderKeyboard(scriptureReaders);
        return await sendMessage(
          chatId,
          getStepMessage("scriptureReader", { ...state.data, scriptureReading: text.trim() }),
          { reply_markup: readerKeyboard, parse_mode: "HTML" }
        );

      case "scriptureReader":
        await updateStateData(userId, { scriptureReader: text.trim() });
        await setWaitingForTextInput(userId, false);
        // If we're in review mode (editing), return to review
        if (state.step === "scriptureReader" && state.data.mode === "edit") {
          await updateStep(userId, "review");
          const updatedState = await getUserState(userId);
          if (!updatedState) return { success: false, error: "State not found" };
          const reviewMessage = getStepMessage("review", updatedState.data);
          const reviewKeyboard = buildReviewKeyboard();
          return await sendMessage(chatId, reviewMessage, {
            reply_markup: reviewKeyboard,
            parse_mode: "HTML",
          });
        }
        return await proceedToReviewOrNextStream(userId, chatId, state);
    }

    return { success: true };
  } catch (error) {
    logError("Error handling Sunday service text input", error);
    return {
      success: false,
      error: "Произошла ошибка при обработке ввода",
    };
  }
};

/**
 * Proceed to review or next stream
 */
const proceedToReviewOrNextStream = async (
  userId: number,
  chatId: number,
  state: SundayServiceState | undefined
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  if (state.data.stream === "both") {
    const currentStream = getCurrentStream(state);
    if (currentStream === "1") {
      // Save stream 1 data and move to stream 2
      await saveCurrentStreamData(userId);
      await updateStateData(userId, { currentStream: "2" });
      await loadCurrentStreamData(userId);
      
      // Generate default title for stream 2 if not set
      const updatedState = await getUserState(userId);
      if (updatedState && !updatedState.data.title && updatedState.data.date) {
        const dateStr = new Date(updatedState.data.date).toLocaleDateString("ru-RU");
        await updateStateData(userId, {
          title: `Воскресное служение II поток - ${dateStr}`,
        });
      }
      
      // Show preview with edit buttons for stream 2
      await updateStep(userId, "review");
      await setWaitingForTextInput(userId, false);
      const finalState = await getUserState(userId);
      if (!finalState) return { success: false, error: "State not found" };
      const reviewMessage = getStepMessage("review", finalState.data);
      const reviewKeyboard = buildEditFieldKeyboard(finalState.data);
      return await sendMessage(chatId, reviewMessage, {
        reply_markup: reviewKeyboard,
        parse_mode: "HTML",
      });
    } else {
      // Save stream 2 data and move to review
      await saveCurrentStreamData(userId);
      await updateStep(userId, "review");
      await setWaitingForTextInput(userId, false);
      const updatedState = await getUserState(userId);
      if (!updatedState) return { success: false, error: "State not found" };
      const reviewMessage = getStepMessage("review", updatedState.data);
      const reviewKeyboard = buildReviewKeyboard();
      return await sendMessage(chatId, reviewMessage, {
        reply_markup: reviewKeyboard,
        parse_mode: "HTML",
      });
    }
  } else {
    // Single stream - move to review
    await updateStep(userId, "review");
    await setWaitingForTextInput(userId, false);
    const reviewMessage = getStepMessage("review", state.data);
    const reviewKeyboard = buildReviewKeyboard();
    return await sendMessage(chatId, reviewMessage, {
      reply_markup: reviewKeyboard,
      parse_mode: "HTML",
    });
  }
};

/**
 * Handle confirm and save
 */
const handleConfirm = async (
  userId: number,
  chatId: number,
  state: SundayServiceState | undefined
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  try {
    if (state.data.stream === "both") {
      // Save both streams
      const validation1 = validateFormData(state.data, "1");
      const validation2 = validateFormData(state.data, "2");

      if (!validation1.valid || !validation2.valid) {
        const errors = [
          ...validation1.errors.map((e) => `I поток: ${e}`),
          ...validation2.errors.map((e) => `II поток: ${e}`),
        ];
        return await sendMessage(
          chatId,
          `❌ <b>Ошибки валидации:</b>\n${errors.join("\n")}\n\nПожалуйста, заполните все обязательные поля и попробуйте сохранить снова.`,
          { parse_mode: "HTML" }
        );
      }

      // Create both services
      const result1 = await createSundayService(state.data, "1");
      if (!result1.success) {
        await clearUserState(userId);
        return await sendMessage(
          chatId,
          `❌ Ошибка при сохранении I потока:\n${result1.error || "Неизвестная ошибка"}\n\nПопробуйте заполнить заново.`,
          { parse_mode: "HTML" }
        );
      }

      const result2 = await createSundayService(state.data, "2");
      if (!result2.success) {
        await clearUserState(userId);
        return await sendMessage(
          chatId,
          `❌ Ошибка при сохранении II потока:\n${result2.error || "Неизвестная ошибка"}\n\nI поток сохранен, но II поток не удалось сохранить. Попробуйте заполнить II поток заново.`,
          { parse_mode: "HTML" }
        );
      }

      // Don't clear state immediately - allow user to continue editing
      const continueKeyboard = buildContinueEditingKeyboard();
      return await sendMessage(
        chatId,
        "✅ Оба воскресных служения успешно сохранены в Notion!",
        { parse_mode: "HTML", reply_markup: continueKeyboard }
      );
    } else {
      // Save single stream
      const streamType = state.data.stream as "1" | "2";
      const validation = validateFormData(state.data, streamType);

      if (!validation.valid) {
        return await sendMessage(
          chatId,
          `❌ <b>Ошибки валидации:</b>\n${validation.errors.join("\n")}\n\nПожалуйста, заполните все обязательные поля и попробуйте сохранить снова.`,
          { parse_mode: "HTML" }
        );
      }

      if (state.data.mode === "edit" && state.data.serviceId) {
        const result = await updateSundayService(
          state.data.serviceId,
          state.data,
          streamType
        );
        if (result.success) {
          // Don't clear state immediately - allow user to continue editing
          const continueKeyboard = buildContinueEditingKeyboard();
          return await sendMessage(
            chatId,
            "✅ Воскресное служение успешно обновлено в Notion!",
            { parse_mode: "HTML", reply_markup: continueKeyboard }
          );
        } else {
          await clearUserState(userId);
          return await sendMessage(
            chatId,
            `❌ Ошибка при обновлении служения:\n${result.error || "Неизвестная ошибка"}\n\nПопробуйте заполнить заново.`,
            { parse_mode: "HTML" }
          );
        }
      } else {
        const result = await createSundayService(state.data, streamType);
        if (result.success) {
          // Save serviceId and switch to edit mode for future updates
          const pageId = result.data?.pageId as string | undefined;
          if (pageId) {
            await updateStateData(userId, {
              serviceId: pageId,
              mode: "edit",
            });
          }
          // Don't clear state immediately - allow user to continue editing
          const continueKeyboard = buildContinueEditingKeyboard();
          return await sendMessage(
            chatId,
            "✅ Воскресное служение успешно сохранено в Notion!",
            { parse_mode: "HTML", reply_markup: continueKeyboard }
          );
        } else {
          await clearUserState(userId);
          return await sendMessage(
            chatId,
            `❌ Ошибка при сохранении служения:\n${result.error || "Неизвестная ошибка"}\n\nПопробуйте заполнить заново.`,
            { parse_mode: "HTML" }
          );
        }
      }
    }
  } catch (error) {
    logError("Error confirming Sunday service", error);
    await clearUserState(userId);
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
 * Handle edit (show field selection)
 */
const handleEdit = async (
  userId: number,
  chatId: number,
  state: SundayServiceState | undefined
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
  state: SundayServiceState | undefined
): Promise<CommandResult> => {
  if (!state) return { success: false, error: "State not found" };

  switch (fieldName) {
    case "title":
      await updateStep(userId, "title");
      await setWaitingForTextInput(userId, true);
      return await sendMessage(chatId, getStepMessage("title", state.data), {
        parse_mode: "HTML",
      });

      case "preachers":
        await updateStep(userId, "preachers");
        await setWaitingForTextInput(userId, false);
        const preachersPage = state.data.preachersPage || 1;
        const preachersKeyboard = buildPreachersKeyboard(state.data.preachers, preachersPage);
        return await sendMessage(
          chatId,
          getStepMessage("preachers", state.data),
          { reply_markup: preachersKeyboard, parse_mode: "HTML" }
        );

    case "worshipService":
      await updateStep(userId, "worshipService");
      await setWaitingForTextInput(userId, false);
      const worshipServices = await getWorshipServices();
      // Store worship services list in state for callback data lookup
      await updateStateData(userId, { worshipServicesList: worshipServices });
      const worshipKeyboard = buildWorshipServiceKeyboard(worshipServices);
      return await sendMessage(
        chatId,
        getStepMessage("worshipService", state.data),
        { reply_markup: worshipKeyboard, parse_mode: "HTML" }
      );

    case "songBeforeStart":
      await updateStep(userId, "songBeforeStart");
      await setWaitingForTextInput(userId, false);
      const songKeyboard = buildYesNoKeyboard("songBeforeStart", state.data.songBeforeStart);
      return await sendMessage(
        chatId,
        getStepMessage("songBeforeStart", state.data),
        { reply_markup: songKeyboard, parse_mode: "HTML" }
      );

    case "numWorshipSongs":
      await updateStep(userId, "numWorshipSongs");
      await setWaitingForTextInput(userId, false);
      const numKeyboard = buildNumberKeyboard("numWorshipSongs", state.data.numWorshipSongs);
      return await sendMessage(
        chatId,
        getStepMessage("numWorshipSongs", state.data),
        { reply_markup: numKeyboard, parse_mode: "HTML" }
      );

    case "soloSong":
      await updateStep(userId, "soloSong");
      await setWaitingForTextInput(userId, false);
      const soloKeyboard = buildYesNoKeyboard("soloSong", state.data.soloSong);
      return await sendMessage(
        chatId,
        getStepMessage("soloSong", state.data),
        { reply_markup: soloKeyboard, parse_mode: "HTML" }
      );

    case "repentanceSong":
      await updateStep(userId, "repentanceSong");
      await setWaitingForTextInput(userId, false);
      const repentanceKeyboard = buildYesNoKeyboard("repentanceSong", state.data.repentanceSong);
      return await sendMessage(
        chatId,
        getStepMessage("repentanceSong", state.data),
        { reply_markup: repentanceKeyboard, parse_mode: "HTML" }
      );

    case "scriptureReading":
      await updateStep(userId, "scriptureReading");
      await setWaitingForTextInput(userId, true);
      return await sendMessage(
        chatId,
        getStepMessage("scriptureReading", state.data),
        { parse_mode: "HTML" }
      );

    case "scriptureReader":
      await updateStep(userId, "scriptureReader");
      await setWaitingForTextInput(userId, false);
      const scriptureReaders = await getScriptureReaders();
      // Store scripture readers list in state for callback data lookup
      await updateStateData(userId, { scriptureReadersList: scriptureReaders });
      const readerKeyboard = buildScriptureReaderKeyboard(scriptureReaders);
      return await sendMessage(
        chatId,
        getStepMessage("scriptureReader", state.data),
        { reply_markup: readerKeyboard, parse_mode: "HTML" }
      );

    default:
      return { success: false, error: "Неизвестное поле" };
  }
};

/**
 * Handle continue editing after successful save
 */
const handleContinueEdit = async (
  userId: number,
  chatId: number,
  state: SundayServiceState | undefined
): Promise<CommandResult> => {
  if (!state) {
    return {
      success: false,
      error: "Сессия не найдена. Начните заново с команды /fill_sunday_service",
    };
  }

  // Return to review step with edit keyboard
  await updateStep(userId, "review");
  await setWaitingForTextInput(userId, false);
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
  _state: SundayServiceState | undefined
): Promise<CommandResult> => {
  await clearUserState(userId);
  return await sendMessage(
    chatId,
    "❌ Заполнение воскресного служения отменено.\n\nВсе несохраненные данные удалены. Вы можете начать заново с команды /fill_sunday_service",
    { parse_mode: "HTML" }
  );
};

