import { CommandResult } from "../types";
import { sendPoll, isUserAllowed } from "../services/telegramService";
import { logInfo, logWarn } from "../utils/logger";

export const executeCreatePollCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult> => {
  logInfo("Executing create poll command", { userId, chatId });

  if (!isUserAllowed(userId)) {
    logWarn("Unauthorized user tried to create poll", { userId });
    return {
      success: false,
      error:
        "У вас нет прав для создания опроса. Пожалуйста, обратитесь к администратору",
    };
  }

  const question = "Приходите ли вы на молодежную встречу?";
  const options = ["Да, приду", "Нет, не смогу", "Пока не знаю"];

  const result = await sendPoll(chatId, question, options);

  if (result.success) {
    logInfo("Poll created successfully", { userId, chatId });
  }

  return result;
};
