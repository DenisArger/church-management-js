import { CommandResult } from "../types";
import { sendMessage, isUserAllowed } from "../services/telegramService";
import { getActivePrayerNeeds } from "../services/notionService";
import { logInfo, logWarn } from "../utils/logger";

export const executePrayerRequestCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult> => {
  logInfo("Executing prayer request command", { userId, chatId });

  if (!isUserAllowed(userId)) {
    logWarn("Unauthorized user tried to request prayers", { userId });
    return {
      success: false,
      error:
        "У вас нет прав для отправки рассылки. Пожалуйста, обратитесь к администратору",
    };
  }

  try {
    const prayerNeeds = await getActivePrayerNeeds();

    if (prayerNeeds.length === 0) {
      return await sendMessage(
        chatId,
        "Нет активных молитвенных нужд для рассылки."
      );
    }

    const message = formatPrayerMessage(prayerNeeds);
    const result = await sendMessage(chatId, message, { parse_mode: "HTML" });

    if (result.success) {
      logInfo("Prayer request sent successfully", {
        userId,
        chatId,
        prayerCount: prayerNeeds.length,
      });
    }

    return result;
  } catch (error) {
    logWarn("Error in prayer request command", error);
    return {
      success: false,
      error: "Произошла ошибка при получении молитвенных нужд",
    };
  }
};

const formatPrayerMessage = (prayerNeeds: any[]): string => {
  let message = "🙏 <b>Молитвенные нужды церкви</b>\n\n";

  prayerNeeds.forEach((need, index) => {
    message += `${index + 1}. ${need.text}\n`;
    if (need.author) {
      message += `   <i>От: ${need.author}</i>\n`;
    }
    if (need.category) {
      message += `   <i>Категория: ${need.category}</i>\n`;
    }
    message += "\n";
  });

  message += "Давайте молиться друг за друга! 🙏";
  return message;
};
