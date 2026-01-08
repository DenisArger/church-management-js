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

<b>📝 Молитвенные нужды:</b>
Просто напишите сообщение с молитвенной нуждой, и бот автоматически её запишет.

<b>⚙️ Параметры команды /request_pray:</b>
• <code>date</code> или <code>дата</code> - сортировка по дате (по умолчанию)
• <code>name</code> или <code>имя</code> - сортировка по алфавиту

<b>📝 Команда /add_prayer:</b>
Формат: <code>Имя | Тема | Неделя (current/next)</code>
• <code>/add_prayer</code> - показать справку по формату
• <code>/add_prayer Иван Петров | Здоровье | current</code>

<b>🔐 Права доступа:</b>
Все команды доступны только авторизованным пользователям.
`;

  const menu = buildMainMenu();

  return await sendMessage(chatId, helpMessage, {
    parse_mode: "HTML",
    reply_markup: menu,
  });
};
