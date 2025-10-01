import TelegramBot from "node-telegram-bot-api";
import { CommandResult } from "../types";
import { logInfo, logError } from "../utils/logger";
import { getTelegramConfig } from "../config/environment";

let botInstance: TelegramBot | null = null;

export const getTelegramBot = (): TelegramBot => {
  if (!botInstance) {
    const config = getTelegramConfig();
    botInstance = new TelegramBot(config.botToken, { polling: false });
    logInfo("Telegram bot initialized");
  }
  return botInstance;
};

export const isUserAllowed = (userId: number): boolean => {
  const config = getTelegramConfig();
  return config.allowedUsers.includes(userId);
};

export const sendMessage = async (
  chatId: number,
  text: string,
  options?: any
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

export const sendPoll = async (
  chatId: number,
  question: string,
  options: string[]
): Promise<CommandResult> => {
  try {
    const bot = getTelegramBot();
    const poll = await bot.sendPoll(chatId, question, options, {
      is_anonymous: false,
      allows_multiple_answers: false,
    });

    logInfo(`Poll sent to ${chatId}`, { pollId: poll.message_id });

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
