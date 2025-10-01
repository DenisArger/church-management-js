import { CommandResult } from "../types";
import { sendMessage, isUserAllowed } from "../services/telegramService";
import { getDailyScripture } from "../services/notionService";
import { logInfo, logWarn } from "../utils/logger";

export const executeDailyScriptureCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult> => {
  logInfo("Executing daily scripture command", { userId, chatId });

  if (!isUserAllowed(userId)) {
    logWarn("Unauthorized user tried to get daily scripture", { userId });
    return {
      success: false,
      error:
        "У вас нет прав для получения ежедневного чтения. Пожалуйста, обратитесь к администратору",
    };
  }

  try {
    const scripture = await getDailyScripture();

    if (!scripture) {
      return await sendMessage(
        chatId,
        "На сегодня нет запланированного чтения Библии."
      );
    }

    const message = formatScriptureMessage(scripture);
    const result = await sendMessage(chatId, message, { parse_mode: "HTML" });

    if (result.success) {
      logInfo("Daily scripture sent successfully", { userId, chatId });
    }

    return result;
  } catch (error) {
    logWarn("Error in daily scripture command", error);
    return {
      success: false,
      error: "Произошла ошибка при получении ежедневного чтения",
    };
  }
};

const formatScriptureMessage = (scripture: any): string => {
  let message = "📖 <b>Ежедневное чтение Библии</b>\n\n";
  message += `<b>${scripture.reference}</b>\n\n`;
  message += `${scripture.text}\n\n`;

  if (scripture.translation) {
    message += `<i>Перевод: ${scripture.translation}</i>\n\n`;
  }

  message += "Благословенного дня! 🙏";
  return message;
};
