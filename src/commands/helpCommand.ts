import { CommandResult } from "../types";
import { sendMessage } from "../services/telegramService";
import { buildMainMenu } from "../utils/menuBuilder";
import { logInfo } from "../utils/logger";

export const executeHelpCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult> => {
  logInfo("Executing help command", { userId, chatId });

  const helpMessage = `
🤖 <b>Главное меню бота</b>

Выберите нужную команду из меню ниже:
`;

  const menu = buildMainMenu();

  return await sendMessage(chatId, helpMessage, {
    parse_mode: "HTML",
    reply_markup: menu,
  });
};
