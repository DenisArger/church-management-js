import { TelegramUpdate, CommandResult } from "../types";
import { executeCreatePollCommand } from "../commands/createPollCommand";
import { executePrayerRequestCommand } from "../commands/prayerRequestCommand";
import { executeDailyScriptureCommand } from "../commands/dailyScriptureCommand";
import { executeSundayServiceCommand } from "../commands/sundayServiceCommand";
import { createPrayerNeed } from "../services/notionService";
import { isPrayerRequest, categorizePrayerNeed } from "../utils/textAnalyzer";
import { logInfo, logWarn } from "../utils/logger";

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

  logInfo("Processing message", {
    userId,
    chatId,
    text: text?.substring(0, 100),
  });

  if (!text) {
    return { success: false, error: "No text in message" };
  }

  // Handle commands
  switch (text.trim()) {
    case "/create_poll":
      return await executeCreatePollCommand(userId, chatId);

    case "/request_pray":
      return await executePrayerRequestCommand(userId, chatId);

    case "/daily_scripture":
      return await executeDailyScriptureCommand(userId, chatId);

    case "/request_state_sunday":
      return await executeSundayServiceCommand(userId, chatId);

    default:
      // Check if it's a prayer request
      if (isPrayerRequest(text)) {
        return await handlePrayerNeed(message);
      }

      return {
        success: false,
        error:
          "Неизвестная команда. Используйте /create_poll, /request_pray, /daily_scripture или /request_state_sunday",
      };
  }
};

const handlePrayerNeed = async (message: any): Promise<CommandResult> => {
  try {
    const text = message.text;
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
