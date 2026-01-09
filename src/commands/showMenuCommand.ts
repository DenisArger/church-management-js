import { CommandResult } from "../types";
import { sendMessage } from "../services/telegramService";
import { buildMainMenu } from "../utils/menuBuilder";
import { logInfo } from "../utils/logger";

export const executeShowMenuCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult> => {
  logInfo("Executing show menu command", { userId, chatId });

  const menuMessage = `
🤖 <b>Главное меню бота</b>

Выберите нужную команду из меню ниже:
`;

  const menu = buildMainMenu();

  return await sendMessage(chatId, menuMessage, {
    parse_mode: "HTML",
    reply_markup: menu,
  });
};







