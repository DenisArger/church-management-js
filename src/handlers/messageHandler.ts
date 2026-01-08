import { TelegramUpdate, CommandResult, TelegramMessage } from "../types";
import { executeCreatePollCommand } from "../commands/createPollCommand";
import { executePrayerRequestCommand } from "../commands/prayerRequestCommand";
import { executeDailyScriptureCommand } from "../commands/dailyScriptureCommand";
import { executeRequestStateSundayCommand } from "../commands/requestStateSundayCommand";
import { executeDebugCalendarCommand } from "../commands/debugCalendarCommand";
import { executeTestNotionCommand } from "../commands/testNotionCommand";
import { executeHelpCommand } from "../commands/helpCommand";
import { executeAddPrayerCommand } from "../commands/addPrayerCommand";
import { executeWeeklyScheduleCommand } from "../commands/weeklyScheduleCommand";
import { executePrayerWeekCommand } from "../commands/prayerWeekCommand";
import { executeYouthPollCommand } from "../commands/youthPollCommand";
import { executeShowMenuCommand } from "../commands/showMenuCommand";
import {
  executeFillSundayServiceCommand,
  handleSundayServiceCallback,
  handleSundayServiceTextInput,
} from "../commands/fillSundayServiceCommand";
import { createPrayerNeed } from "../services/notionService";
import { isPrayerRequest, categorizePrayerNeed } from "../utils/textAnalyzer";
import { logInfo, logWarn } from "../utils/logger";
import { isUserAuthorized, getUnauthorizedMessage } from "../utils/authHelper";
import { sendMessage, answerCallbackQuery } from "../services/telegramService";
import { parseCallbackData } from "../utils/menuBuilder";
import {
  hasActiveState,
  getUserState,
  updateStateData,
  updateStep,
  setWaitingForTextInput,
  getCurrentStream,
  saveCurrentStreamData,
} from "../utils/sundayServiceState";
import {
  isScriptureSchedule,
  parseScriptureSchedule,
  ParsedScheduleEntry,
} from "../utils/scriptureScheduleParser";
import {
  getStepMessage,
  buildReviewKeyboard,
} from "../utils/sundayServiceFormBuilder";
import {
  getSundayServiceByDate,
  createSundayService,
  updateSundayService,
} from "../services/calendarService";
import { formatDateForNotion } from "../utils/dateHelper";

export const handleUpdate = async (
  update: TelegramUpdate
): Promise<CommandResult> => {
  // Handle callback_query (inline button clicks)
  if (update.callback_query) {
    return await handleCallbackQuery(update.callback_query);
  }

  // Handle regular messages
  if (update.message) {
    return await handleMessage(update);
  }

  return { success: false, error: "No message or callback_query in update" };
};

// Keep old function name for backward compatibility
export const handleMessage = async (
  update: TelegramUpdate
): Promise<CommandResult> => {
  if (!update.message) {
    return { success: false, error: "No message in update" };
  }

  const message = update.message;
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text;
  const chatType = message.chat.type;

  logInfo("Processing message", {
    userId,
    chatId,
    chatType,
    text: text?.substring(0, 100),
  });

  if (!text) {
    return { success: false, error: "No text in message" };
  }

  // Handle commands
  const commandParts = text.trim().split(" ");
  const command = commandParts[0];
  const params = commandParts.slice(1);

  // Check if it's a command (starts with /)
  const isCommand = command.startsWith("/");

  // Check for scripture schedule in private chats (before other checks)
  if (!isCommand && chatType === "private") {
    const isForwarded = message.forward_from !== undefined;
    const containsSchedule = isScriptureSchedule(text);

    if (isForwarded || containsSchedule) {
      // Process scripture schedule (works with or without active form state)
      return await handleScriptureScheduleMessage(userId, chatId, text);
    }
  }

  // Check if user is in Sunday service form filling process
  if (!isCommand && chatType === "private" && hasActiveState(userId)) {
    // Handle regular text input for Sunday service form
    return await handleSundayServiceTextInput(userId, chatId, text);
  }

  // In groups, only process commands - ignore everything else
  if (chatType === "group" || chatType === "supergroup") {
    if (!isCommand) {
      logInfo("Ignoring non-command message in group", {
        userId,
        chatId,
        text: text.substring(0, 50),
      });
      return { success: true, message: "Message ignored" };
    }
  }

  // Check authorization for commands
  if (isCommand && !isUserAuthorized(userId)) {
    return await sendMessage(chatId, getUnauthorizedMessage(), {
      parse_mode: "HTML",
    });
  }

  switch (command) {
    case "/create_poll":
      return await executeCreatePollCommand(userId, chatId);

    case "/request_pray":
      return await executePrayerRequestCommand(userId, chatId, params);

    case "/daily_scripture":
      return await executeDailyScriptureCommand(userId, chatId);

    case "/request_state_sunday":
      return await executeRequestStateSundayCommand(userId, chatId);

    case "/debug_calendar":
      return await executeDebugCalendarCommand(userId, chatId);

    case "/test_notion":
      return await executeTestNotionCommand(userId, chatId);

    case "/help":
      return await executeHelpCommand(userId, chatId);

    case "/add_prayer":
      return await executeAddPrayerCommand(userId, chatId, params);

    case "/weekly_schedule":
      return await executeWeeklyScheduleCommand(userId, chatId);

    case "/prayer_week":
      return await executePrayerWeekCommand(userId, chatId);

    case "/youth_poll":
      return await executeYouthPollCommand(userId, chatId);

    case "/menu":
      return await executeShowMenuCommand(userId, chatId);

    case "/fill_sunday_service":
    case "/edit_sunday_service":
      return await executeFillSundayServiceCommand(userId, chatId);

    default:
      // Check if it's a prayer request (only in private chats)
      if (chatType === "private" && isPrayerRequest(text)) {
        return await handlePrayerNeed(message);
      }

      // Ignore other messages
      logInfo("Ignoring message", {
        userId,
        chatId,
        text: text.substring(0, 50),
      });
      return { success: true, message: "Message ignored" };
  }
};

/**
 * Process single schedule entry - update or create Sunday service
 */
const processScheduleEntry = async (
  entry: ParsedScheduleEntry,
  stream: "1" | "2"
): Promise<{ success: boolean; updated: boolean; created: boolean }> => {
  try {
    const reader = stream === "1" ? entry.stream1Reader : entry.stream2Reader;
    
    logInfo("Processing schedule entry", {
      date: formatDateForNotion(entry.date),
      dateISO: entry.date.toISOString(),
      stream,
      scriptureReading: entry.scriptureReading,
      reader,
    });
    
    // Check if service already exists
    const existingService = await getSundayServiceByDate(entry.date, stream);
    
    if (existingService) {
      logInfo("Service exists, updating", {
        serviceId: existingService.id,
        date: formatDateForNotion(entry.date),
        stream,
      });
      
      // Update existing service - only scripture reading and reader
      // Don't update date, only update scripture reading and reader fields
      const updateData: import("../types").SundayServiceFormData = {
        scriptureReading: entry.scriptureReading,
        mode: "edit",
        stream: stream,
      };
      
      // Always set reader field - if undefined, set to undefined explicitly to clear it
      // This ensures the field is updated even if it was not specified in the schedule
      updateData.scriptureReader = reader !== undefined ? (reader || undefined) : undefined;
      
      logInfo("Updating service with data", {
        serviceId: existingService.id,
        stream,
        scriptureReading: entry.scriptureReading,
        reader,
        updateData: {
          scriptureReading: updateData.scriptureReading,
          scriptureReader: updateData.scriptureReader,
        },
      });
      
      const result = await updateSundayService(
        existingService.id,
        updateData,
        stream
      );
      
      if (!result.success) {
        logWarn("Failed to update service", {
          error: result.error,
          serviceId: existingService.id,
          stream,
          updateData,
        });
      } else {
        logInfo("Service updated successfully", {
          serviceId: existingService.id,
          stream,
        });
      }
      
      return {
        success: result.success,
        updated: result.success,
        created: false,
      };
    } else {
      logInfo("Service does not exist, creating", {
        date: formatDateForNotion(entry.date),
        dateISO: entry.date.toISOString(),
        stream,
      });
      
      // Create new service with minimal data
      const createData: import("../types").SundayServiceFormData = {
        date: entry.date,
        scriptureReading: entry.scriptureReading,
        mode: "create",
        stream: stream,
      };
      
      // Only add reader if specified
      if (reader) {
        createData.scriptureReader = reader;
      }
      
      const result = await createSundayService(createData, stream);
      
      if (!result.success) {
        logWarn("Failed to create service", {
          error: result.error,
          date: formatDateForNotion(entry.date),
          stream,
          createData,
        });
      } else {
        logInfo("Service created successfully", {
          date: formatDateForNotion(entry.date),
          stream,
          pageId: result.data?.pageId,
        });
      }
      
      return {
        success: result.success,
        updated: false,
        created: result.success,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logWarn("Error processing schedule entry", {
      error: errorMessage,
      errorStack,
      entry: {
        date: entry.date.toISOString(),
        scriptureReading: entry.scriptureReading,
        stream1Reader: entry.stream1Reader,
        stream2Reader: entry.stream2Reader,
      },
      stream,
    });
    return { success: false, updated: false, created: false };
  }
};

/**
 * Handle forwarded message or message with scripture schedule
 * If date is selected in form - process only that date
 * Otherwise - process all dates from schedule
 */
const handleScriptureScheduleMessage = async (
  userId: number,
  chatId: number,
  text: string
): Promise<CommandResult> => {
  try {
    // Parse schedule from message
    const schedule = parseScriptureSchedule(text);
    if (schedule.length === 0) {
      logInfo("No schedule entries found in message", { userId });
      return await sendMessage(
        chatId,
        "❌ Не удалось распарсить график. Проверьте формат сообщения.",
        { parse_mode: "HTML" }
      );
    }

    // Get current user state
    const state = getUserState(userId);
    const hasSelectedDate = state && state.data.date;

    if (hasSelectedDate) {
      // Process only selected date
      return await handleSelectedDateSchedule(userId, chatId, schedule, state!);
    } else {
      // Process all dates from schedule
      return await handleAllDatesSchedule(userId, chatId, schedule);
    }
  } catch (error) {
    logWarn("Error handling scripture schedule message", error);
    return {
      success: false,
      error: "Произошла ошибка при обработке графика",
    };
  }
};

/**
 * Handle schedule for selected date in form
 */
const handleSelectedDateSchedule = async (
  userId: number,
  chatId: number,
  schedule: ParsedScheduleEntry[],
  state: ReturnType<typeof getUserState>
): Promise<CommandResult> => {
  if (!state || !state.data.date) {
    return { success: false, error: "State or date not found" };
  }

  // Determine which stream we're working with
  let targetStream: "1" | "2";
  if (state.data.stream === "both") {
    const currentStream = getCurrentStream(state);
    if (!currentStream) {
      return await sendMessage(
        chatId,
        "❌ Не выбран поток. Выберите поток для заполнения.",
        { parse_mode: "HTML" }
      );
    }
    targetStream = currentStream;
  } else if (state.data.stream === "1" || state.data.stream === "2") {
    targetStream = state.data.stream;
  } else {
    return await sendMessage(
      chatId,
      "❌ Не выбран поток. Выберите поток для заполнения.",
      { parse_mode: "HTML" }
    );
  }

  // Find matching entry
  const normalizedTarget = new Date(state.data.date);
  normalizedTarget.setHours(0, 0, 0, 0);

  const entry = schedule.find((e) => {
    const normalizedEntry = new Date(e.date);
    normalizedEntry.setHours(0, 0, 0, 0);
    return normalizedEntry.getTime() === normalizedTarget.getTime();
  });

  if (!entry) {
    return await sendMessage(
      chatId,
      "❌ Не найдена соответствующая запись в графике для выбранной даты.",
      { parse_mode: "HTML" }
    );
  }

  // Auto-fill fields
  const updates: Partial<typeof state.data> = {
    scriptureReading: entry.scriptureReading,
  };

  // Fill reader only if it's not empty
  const reader =
    targetStream === "1" ? entry.stream1Reader : entry.stream2Reader;
  if (reader) {
    updates.scriptureReader = reader;
  }

  // For "both" streams mode, save current stream data before updating
  if (state.data.stream === "both") {
    saveCurrentStreamData(userId);
  }

  // Update state with new data
  updateStateData(userId, updates);
  setWaitingForTextInput(userId, false);

  // Move to review step
  updateStep(userId, "review");

  // Get updated state
  const updatedState = getUserState(userId);
  if (!updatedState) {
    return { success: false, error: "State not found after update" };
  }

  // Show preview with confirmation buttons
  const reviewMessage = getStepMessage("review", updatedState.data);
  const infoMessage = `✅ <b>Данные автоматически заполнены из графика!</b>\n\n${reviewMessage}`;
  const reviewKeyboard = buildReviewKeyboard();

  logInfo("Auto-filled scripture data from schedule", {
    userId,
    date: state.data.date,
    stream: targetStream,
    scriptureReading: entry.scriptureReading,
    reader,
  });

  return await sendMessage(chatId, infoMessage, {
    reply_markup: reviewKeyboard,
    parse_mode: "HTML",
  });
};

/**
 * Handle schedule for all dates - update/create services in Notion
 */
const handleAllDatesSchedule = async (
  userId: number,
  chatId: number,
  schedule: ParsedScheduleEntry[]
): Promise<CommandResult> => {
  let processed = 0;
  let updated = 0;
  let created = 0;
  let errors = 0;

  // Process each entry
  for (const entry of schedule) {
    // Process stream 1 if scripture reading is available
    // (reader may be empty or undefined, but we still want to update scripture reading)
    if (entry.scriptureReading) {
      const result = await processScheduleEntry(entry, "1");
      processed++;
      if (result.success) {
        if (result.updated) updated++;
        if (result.created) created++;
      } else {
        errors++;
      }
    }

    // Process stream 2 if scripture reading is available
    // (reader may be empty or undefined, but we still want to update scripture reading)
    if (entry.scriptureReading) {
      const result = await processScheduleEntry(entry, "2");
      processed++;
      if (result.success) {
        if (result.updated) updated++;
        if (result.created) created++;
      } else {
        errors++;
      }
    }
  }

  // Build result message
  let message = `✅ <b>График обработан!</b>\n\n`;
  message += `📅 Обработано записей: ${processed}\n`;
  if (created > 0) {
    message += `➕ Создано новых: ${created}\n`;
  }
  if (updated > 0) {
    message += `✏️ Обновлено существующих: ${updated}\n`;
  }
  if (errors > 0) {
    message += `❌ Ошибок: ${errors}\n`;
  }

  logInfo("Processed all schedule entries", {
    userId,
    processed,
    created,
    updated,
    errors,
  });

  return await sendMessage(chatId, message, { parse_mode: "HTML" });
};

const handlePrayerNeed = async (
  message: TelegramMessage
): Promise<CommandResult> => {
  try {
    const text = message.text;
    if (!text) {
      return {
        success: false,
        error: "No text in prayer message",
      };
    }

    const author = `${message.from.first_name} ${
      message.from.last_name || ""
    }`.trim();
    const category = categorizePrayerNeed(text);

    logInfo("Processing prayer need", { author, category });

    const result = await createPrayerNeed(text, author, category);

    if (result.success) {
      logInfo("Prayer need processed successfully", { author });
      return {
        success: true,
        message: "Ваша молитвенная нужда записана. Будем молиться! 🙏",
      };
    }

    return result;
  } catch (error) {
    logWarn("Error processing prayer need", error);
    return {
      success: false,
      error: "Произошла ошибка при обработке молитвенной нужды",
    };
  }
};

const handleCallbackQuery = async (
  callbackQuery: TelegramUpdate["callback_query"]
): Promise<CommandResult> => {
  if (!callbackQuery || !callbackQuery.data) {
    return { success: false, error: "No callback data" };
  }

  const userId = callbackQuery.from.id;
  const chatId = callbackQuery.message?.chat.id || userId;
  const callbackData = callbackQuery.data;
  const callbackQueryId = callbackQuery.id;

  logInfo("Processing callback query", {
    userId,
    chatId,
    callbackData,
  });

  // Check authorization
  if (!isUserAuthorized(userId)) {
    await answerCallbackQuery(callbackQueryId, "У вас нет доступа к этой команде", true);
    return { success: false, error: "Unauthorized" };
  }

  // Check if it's a Sunday service callback
  if (callbackData.startsWith("sunday:")) {
    await answerCallbackQuery(callbackQueryId);
    const messageId = callbackQuery.message?.message_id;
    return await handleSundayServiceCallback(
      userId,
      chatId,
      callbackData,
      messageId
    );
  }

  // Parse callback data
  const parsed = parseCallbackData(callbackData);

  if (parsed.type === "menu") {
    // Show main menu
    await answerCallbackQuery(callbackQueryId);
    return await executeShowMenuCommand(userId, chatId);
  }

  if (parsed.type === "cmd" && parsed.command) {
    // Answer callback query first
    await answerCallbackQuery(callbackQueryId);

    // Execute corresponding command
    const params = parsed.params || [];
    switch (parsed.command) {
      case "request_pray":
        return await executePrayerRequestCommand(userId, chatId, params);

      case "daily_scripture":
        return await executeDailyScriptureCommand(userId, chatId);

      case "create_poll":
        return await executeCreatePollCommand(userId, chatId);

      case "add_prayer":
        return await executeAddPrayerCommand(userId, chatId, params);

      case "prayer_week":
        return await executePrayerWeekCommand(userId, chatId);

      case "weekly_schedule":
        return await executeWeeklyScheduleCommand(userId, chatId);

      case "request_state_sunday":
        return await executeRequestStateSundayCommand(userId, chatId);

      case "fill_sunday_service":
      case "edit_sunday_service":
        return await executeFillSundayServiceCommand(userId, chatId);

      case "youth_poll":
        return await executeYouthPollCommand(userId, chatId);

      case "test_notion":
        return await executeTestNotionCommand(userId, chatId);

      case "debug_calendar":
        return await executeDebugCalendarCommand(userId, chatId);

      default:
        logWarn("Unknown command in callback", { command: parsed.command });
        return {
          success: false,
          error: `Неизвестная команда: ${parsed.command}`,
        };
    }
  }

  logWarn("Unknown callback data format", { callbackData });
  await answerCallbackQuery(callbackQueryId, "Неизвестная команда", true);
  return { success: false, error: "Unknown callback data format" };
};
