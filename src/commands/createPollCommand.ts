import { CommandResult } from "../types";
import { sendPoll, getTelegramBot } from "../services/telegramService";
import { logInfo } from "../utils/logger";

export const executeCreatePollCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult> => {
  logInfo("Executing create poll command", { userId, chatId });

  const question = "Приходите ли вы на молодежную встречу?";
  const options = ["Да, приду", "Нет, не смогу", "Пока не знаю"];

  const bot = getTelegramBot();
  const result = await sendPoll(bot, chatId, question, options);

  if (result.success) {
    logInfo("Poll created successfully", { userId, chatId });
  }

  return result;
};
