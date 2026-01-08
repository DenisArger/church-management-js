import TelegramBot from "node-telegram-bot-api";
import { CommandResult } from "../types";
import { logInfo, logError } from "../utils/logger";
import { getTelegramConfig, getAppConfig } from "../config/environment";

let botInstance: TelegramBot | null = null;
let debugBotInstance: TelegramBot | null = null;

export const getTelegramBot = (): TelegramBot => {
  if (!botInstance) {
    const config = getTelegramConfig();
    botInstance = new TelegramBot(config.botToken, { polling: false });
    logInfo("Telegram bot initialized");
  }
  return botInstance;
};

export const getDebugTelegramBot = (): TelegramBot => {
  if (!debugBotInstance) {
    const config = getTelegramConfig();
    if (!config.debugBotToken) {
      throw new Error("Debug bot token not configured");
    }
    debugBotInstance = new TelegramBot(config.debugBotToken, {
      polling: false,
    });
    logInfo("Debug Telegram bot initialized");
  }
  return debugBotInstance;
};

export const getTelegramConfigForMode = (isDebug: boolean) => {
  const config = getTelegramConfig();
  const appConfig = getAppConfig();

  if (isDebug || appConfig.debug) {
    return {
      bot: getDebugTelegramBot(),
      chatId: config.debugChatId ? parseInt(config.debugChatId) : null,
      topicId: config.debugTopicId ? parseInt(config.debugTopicId) : undefined,
    };
  } else {
    return {
      bot: getTelegramBot(),
      chatId: config.youthGroupId ? parseInt(config.youthGroupId) : null,
      topicId: undefined,
    };
  }
};

export const sendMessage = async (
  chatId: number,
  text: string,
  options?: Record<string, unknown>
): Promise<CommandResult> => {
  try {
    const bot = getTelegramBot();
    const message = await bot.sendMessage(chatId, text, options);
    logInfo(`Message sent to ${chatId}`, { messageId: message.message_id });

    return {
      success: true,
      message: "Message sent successfully",
      data: { messageId: message.message_id },
    };
  } catch (error) {
    logError("Error sending message", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const sendMessageToUser = async (
  userId: number,
  text: string,
  options?: Record<string, unknown>
): Promise<CommandResult> => {
  try {
    const bot = getTelegramBot();
    const message = await bot.sendMessage(userId, text, options);
    logInfo(`Message sent to user ${userId}`, {
      messageId: message.message_id,
    });

    return {
      success: true,
      message: "Message sent successfully",
      data: { messageId: message.message_id },
    };
  } catch (error) {
    logError("Error sending message to user", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const sendPoll = async (
  bot: TelegramBot,
  chatId: number,
  question: string,
  options: string[],
  messageThreadId?: number
): Promise<CommandResult> => {
  try {
    const pollOptions: Record<string, unknown> = {
      is_anonymous: false,
      allows_multiple_answers: false,
    };

    // Add message thread ID for topics in supergroups
    if (messageThreadId) {
      pollOptions.message_thread_id = messageThreadId;
    }

    const poll = await bot.sendPoll(chatId, question, options, pollOptions);

    // Determine bot mode for logging
    const isDebugBot = bot === debugBotInstance;
    const botMode = isDebugBot ? "debug" : "production";

    logInfo(`Poll sent to ${chatId}`, {
      pollId: poll.message_id,
      messageThreadId: messageThreadId || "none",
      botMode,
    });

    return {
      success: true,
      message: "Poll sent successfully",
      data: { pollId: poll.message_id },
    };
  } catch (error) {
    logError("Error sending poll", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const sendPhoto = async (
  chatId: number,
  photo: string,
  caption?: string
): Promise<CommandResult> => {
  try {
    const bot = getTelegramBot();
    const message = await bot.sendPhoto(chatId, photo, { caption });

    logInfo(`Photo sent to ${chatId}`, { messageId: message.message_id });

    return {
      success: true,
      message: "Photo sent successfully",
      data: { messageId: message.message_id },
    };
  } catch (error) {
    logError("Error sending photo", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
