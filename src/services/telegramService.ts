import TelegramBot from "node-telegram-bot-api";
import { CommandResult, TelegramMessage } from "../types";
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

  const debugRaw = String(process.env.DEBUG ?? "").trim().toLowerCase();
  const hasDebugOverride = debugRaw === "true" || debugRaw === "false" || debugRaw === "1" || debugRaw === "0";
  const debugOverride = debugRaw === "true" || debugRaw === "1";
  const effectiveDebug = hasDebugOverride ? debugOverride : (isDebug || appConfig.debug);

  if (effectiveDebug) {
    return {
      bot: getDebugTelegramBot(),
      chatId: config.debugChatId ? parseInt(config.debugChatId) : null,
      topicId: config.debugTopicId ? parseInt(config.debugTopicId) : undefined,
    };
  } else {
    let chatId: number | null = null;
    if (config.youthGroupId) {
      // Parse as integer, handling negative numbers correctly
      const parsed = parseInt(config.youthGroupId.trim(), 10);
      chatId = isNaN(parsed) ? null : parsed;
    }
    return {
      bot: getTelegramBot(),
      chatId: chatId,
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

export const sendMessageWithBot = async (
  bot: TelegramBot,
  chatId: number,
  text: string,
  options?: Record<string, unknown>
): Promise<CommandResult> => {
  try {
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

export const answerCallbackQuery = async (
  callbackQueryId: string,
  text?: string,
  showAlert?: boolean
): Promise<CommandResult> => {
  try {
    const bot = getTelegramBot();
    await bot.answerCallbackQuery(callbackQueryId, {
      text,
      show_alert: showAlert,
    });

    logInfo(`Callback query answered`, { callbackQueryId });

    return {
      success: true,
      message: "Callback query answered successfully",
    };
  } catch (error) {
    logError("Error answering callback query", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const copyMessageToTopic = async (
  chatId: number,
  fromChatId: number,
  messageId: number,
  messageThreadId: number
): Promise<CommandResult> => {
  try {
    const bot = getTelegramBot();
    const copiedMessageId = await bot.copyMessage(chatId, fromChatId, messageId, {
      message_thread_id: messageThreadId,
    });

    logInfo(`Message copied to topic ${messageThreadId}`, {
      chatId,
      fromChatId,
      messageId,
      copiedMessageId,
    });

    return {
      success: true,
      message: "Message copied successfully",
      data: { messageId: copiedMessageId },
    };
  } catch (error) {
    logError("Error copying message to topic", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const deleteTelegramMessage = async (
  chatId: number,
  messageId: number
): Promise<CommandResult> => {
  try {
    const bot = getTelegramBot();
    await bot.deleteMessage(chatId, messageId);

    logInfo(`Message deleted from ${chatId}`, { messageId });

    return {
      success: true,
      message: "Message deleted successfully",
    };
  } catch (error) {
    logError("Error deleting message", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const safeRepublishBroadcastMessage = async (
  message: TelegramMessage,
  rewrittenText: string
): Promise<CommandResult> => {
  try {
    const bot = getTelegramBot();

    if (!message.message_thread_id) {
      return {
        success: false,
        error: "Message thread ID is required for broadcast republish",
      };
    }

    const copied = await bot.copyMessage(
      message.chat.id,
      message.chat.id,
      message.message_id,
      { message_thread_id: message.message_thread_id }
    );
    const copiedMessageId = copied.message_id;

    if (message.text !== undefined) {
      await bot.editMessageText(rewrittenText, {
        chat_id: message.chat.id,
        message_id: copiedMessageId,
      });
    } else if (message.caption !== undefined) {
      await bot.editMessageCaption(rewrittenText, {
        chat_id: message.chat.id,
        message_id: copiedMessageId,
      });
    } else {
      return {
        success: false,
        error: "Unsupported message type for broadcast republish",
      };
    }

    logInfo("Broadcast message republished", {
      chatId: message.chat.id,
      sourceMessageId: message.message_id,
      copiedMessageId,
      messageThreadId: message.message_thread_id,
    });

    return {
      success: true,
      message: "Broadcast message republished successfully",
      data: { messageId: copiedMessageId },
    };
  } catch (error) {
    logError("Error republishing broadcast message", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
