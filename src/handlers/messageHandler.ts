import { TelegramUpdate, CommandResult, TelegramMessage } from "../types";
import { executeCreatePollCommand } from "../commands/createPollCommand";
import {
  executePrayerRequestCommand,
  executeAllPrayersCommand,
  executeOldPrayersCommand,
} from "../commands/prayerRequestCommand";
import { executeRequestStateSundayCommand } from "../commands/requestStateSundayCommand";
import { executeDebugCalendarCommand } from "../commands/debugCalendarCommand";
import { executeTestNotionCommand } from "../commands/testNotionCommand";
import { executeHelpCommand } from "../commands/helpCommand";
import {
  executeAddPrayerCommand,
  handlePrayerCallback,
} from "../commands/addPrayerCommand";
import { executeWeeklyScheduleCommand } from "../commands/weeklyScheduleCommand";
import { executePrayerWeekCommand } from "../commands/prayerWeekCommand";
import { executeShowMenuCommand } from "../commands/showMenuCommand";
import {
  executeFillSundayServiceCommand,
  handleSundayServiceCallback,
  handleSundayServiceTextInput,
} from "../commands/fillSundayServiceCommand";
import {
  executeEditScheduleCommand,
  handleScheduleCallback,
  handleScheduleTextInput,
} from "../commands/editScheduleCommand";
import {
  executeYouthReportCommand,
  handleYouthReportCallback,
} from "../commands/youthReportCommand";
import { createPrayerNeed } from "../services/notionService";
import { isPrayerRequest, categorizePrayerNeed } from "../utils/textAnalyzer";
import { logInfo, logWarn } from "../utils/logger";
import { isUserAuthorized, getUnauthorizedMessage, isYouthLeader } from "../utils/authHelper";
import { sendMessage, answerCallbackQuery } from "../services/telegramService";
import { parseCallbackData, buildPrayerMenu, buildScheduleMenu, buildSundayMenu } from "../utils/menuBuilder";
import { hasActiveState } from "../utils/sundayServiceState";
import {
  hasActiveState as hasActiveScheduleState,
} from "../utils/scheduleState";
import {
  hasActivePrayerState,
} from "../utils/prayerState";
import {
  hasActiveYouthReportState,
} from "../utils/youthReportState";
import { isScriptureSchedule } from "../utils/scriptureScheduleParser";
import { handleScriptureScheduleMessage } from "./scriptureScheduleHandler";

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
  const messageThreadId = (message as any).message_thread_id;
  const forwardFromChat = (message as any).forward_from_chat;

  logInfo("Processing message", {
    userId,
    chatId,
    chatType,
    messageThreadId: messageThreadId ?? null,
    forwardFromChatId: forwardFromChat?.id ?? null,
    forwardFromChatTitle: forwardFromChat?.title ?? null,
    text: text?.substring(0, 100),
    command: text?.trim().split(" ")[0] ?? null,
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
  if (!isCommand && chatType === "private" && (await hasActiveState(userId))) {
    // Handle regular text input for Sunday service form
    return await handleSundayServiceTextInput(userId, chatId, text);
  }

  // Check if user is in schedule form filling process
  if (!isCommand && chatType === "private" && (await hasActiveScheduleState(userId))) {
    // Handle regular text input for schedule form
    return await handleScheduleTextInput(userId, chatId, text);
  }

  // Check if user is in prayer form filling process
  if (!isCommand && chatType === "private" && (await hasActivePrayerState(userId))) {
    // Handle regular text input for prayer form
    return await executeAddPrayerCommand(userId, chatId, [text]);
  }

  // Check if user is in youth report form filling process
  if (!isCommand && chatType === "private" && (await hasActiveYouthReportState(userId))) {
    // Handle regular text input for youth report form
    return await executeYouthReportCommand(userId, chatId, [text]);
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
  // Special case: /youth_report allows both authorized users and youth leaders
  if (isCommand && command === "/youth_report") {
    // Check youth leader first - if user is a leader, allow access without checking authorization
    const isLeader = await isYouthLeader(userId);
    if (!isLeader) {
      // Only check authorization if user is not a leader
      if (!isUserAuthorized(userId)) {
        return await sendMessage(chatId, getUnauthorizedMessage(), {
          parse_mode: "HTML",
        });
      }
    }
  } else if (isCommand && !isUserAuthorized(userId)) {
    return await sendMessage(chatId, getUnauthorizedMessage(), {
      parse_mode: "HTML",
    });
  }

  switch (command) {
    case "/create_poll":
      return await executeCreatePollCommand(userId, chatId);

    case "/request_pray":
      return await executePrayerRequestCommand(userId, chatId, params);

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

    case "/menu":
      return await executeShowMenuCommand(userId, chatId);

    case "/fill_sunday_service":
    case "/edit_sunday_service":
      return await executeFillSundayServiceCommand(userId, chatId);

    case "/edit_schedule":
      return await executeEditScheduleCommand(userId, chatId);

    case "/youth_report":
      return await executeYouthReportCommand(userId, chatId, params);

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
    command: callbackData?.split(":")[0] ?? null,
  });

  // Check if it's a youth report callback - special authorization check
  if (callbackData.startsWith("youth_report:")) {
    // Check youth leader first - if user is a leader, allow access without checking authorization
    const isLeader = await isYouthLeader(userId);
    if (!isLeader) {
      // Only check authorization if user is not a leader
      if (!isUserAuthorized(userId)) {
        await answerCallbackQuery(callbackQueryId, "У вас нет доступа к этой команде", true);
        return { success: false, error: "Unauthorized" };
      }
    }
    await answerCallbackQuery(callbackQueryId);
    const messageId = callbackQuery.message?.message_id;
    return await handleYouthReportCallback(
      userId,
      chatId,
      callbackData,
      messageId
    );
  }

  // Check authorization for other callbacks
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

  // Check if it's a schedule callback
  if (callbackData.startsWith("schedule:")) {
    await answerCallbackQuery(callbackQueryId);
    const messageId = callbackQuery.message?.message_id;
    return await handleScheduleCallback(
      userId,
      chatId,
      callbackData,
      messageId
    );
  }

  // Check if it's a prayer form callback
  if (callbackData.startsWith("prayer:")) {
    await answerCallbackQuery(callbackQueryId);
    const messageId = callbackQuery.message?.message_id;
    return await handlePrayerCallback(
      userId,
      chatId,
      callbackData,
      messageId
    );
  }

  // Parse callback data
  const parsed = parseCallbackData(callbackData);

  if (parsed.type === "menu") {
    await answerCallbackQuery(callbackQueryId);
    
    // Handle submenus
    if (parsed.command === "prayer") {
      // Show prayer submenu
      const prayerMenuMessage = `
🙏 <b>Молитва за молодежь</b>

Выберите нужную команду:
`;
      const prayerMenu = buildPrayerMenu();
      return await sendMessage(chatId, prayerMenuMessage, {
        parse_mode: "HTML",
        reply_markup: prayerMenu,
      });
    }
    
    if (parsed.command === "schedule") {
      // Show schedule submenu
      const scheduleMenuMessage = `
📆 <b>Расписание</b>

Выберите нужную команду:
`;
      const scheduleMenu = buildScheduleMenu();
      return await sendMessage(chatId, scheduleMenuMessage, {
        parse_mode: "HTML",
        reply_markup: scheduleMenu,
      });
    }
    
    if (parsed.command === "sunday") {
      // Show Sunday service submenu
      const sundayMenuMessage = `
⛪ <b>Готовность к воскресному служению</b>

Выберите нужную команду:
`;
      const sundayMenu = buildSundayMenu();
      return await sendMessage(chatId, sundayMenuMessage, {
        parse_mode: "HTML",
        reply_markup: sundayMenu,
      });
    }
    
    // Show main menu (menu:main or no submenu)
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

      case "create_poll":
        return await executeCreatePollCommand(userId, chatId);

      case "add_prayer":
        return await executeAddPrayerCommand(userId, chatId, params);

      case "prayer_week":
        return await executePrayerWeekCommand(userId, chatId);

      case "all_prayers":
        return await executeAllPrayersCommand(userId, chatId, params);

      case "old_prayers":
        return await executeOldPrayersCommand(userId, chatId, params);

      case "weekly_schedule":
        // Handle weekly schedule with optional week type parameter
        if (params.length > 0) {
          const weekType = params[0] as "current" | "next";
          if (weekType === "current" || weekType === "next") {
            return await executeWeeklyScheduleCommand(userId, chatId, weekType);
          }
        }
        // If no parameter or invalid parameter, show selection menu
        return await executeWeeklyScheduleCommand(userId, chatId);

      case "request_state_sunday":
        return await executeRequestStateSundayCommand(userId, chatId);

      case "fill_sunday_service":
      case "edit_sunday_service":
        return await executeFillSundayServiceCommand(userId, chatId);

      case "edit_schedule":
        return await executeEditScheduleCommand(userId, chatId);

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
