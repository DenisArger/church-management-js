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
import { createPrayerNeed } from "../services/notionService";
import { isPrayerRequest, categorizePrayerNeed } from "../utils/textAnalyzer";
import { logInfo, logWarn } from "../utils/logger";
import { isUserAuthorized, getUnauthorizedMessage } from "../utils/authHelper";
import { sendMessage } from "../services/telegramService";

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
