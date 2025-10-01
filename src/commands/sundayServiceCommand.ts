import { CommandResult } from "../types";
import { sendMessage, isUserAllowed } from "../services/telegramService";
import { getCalendarItems } from "../services/notionService";
import { getCurrentDate, addDays, formatDate } from "../utils/dateHelper";
import { logInfo, logWarn } from "../utils/logger";

export const executeSundayServiceCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult> => {
  logInfo("Executing sunday service command", { userId, chatId });

  if (!isUserAllowed(userId)) {
    logWarn("Unauthorized user tried to get sunday service info", { userId });
    return {
      success: false,
      error:
        "У вас нет прав для получения информации о воскресном служении. Пожалуйста, обратитесь к администратору",
    };
  }

  try {
    const today = getCurrentDate();
    const nextSunday = getNextSunday(today);
    const weekEnd = addDays(nextSunday, 7);

    const calendarItems = await getCalendarItems(nextSunday, weekEnd);
    const sundayServices = calendarItems.filter(
      (item) =>
        item.type === "service" || item.title.toLowerCase().includes("служение")
    );

    if (sundayServices.length === 0) {
      return await sendMessage(
        chatId,
        "Информация о воскресном служении пока не доступна."
      );
    }

    const message = formatSundayServiceMessage(sundayServices, nextSunday);
    const result = await sendMessage(chatId, message, { parse_mode: "HTML" });

    if (result.success) {
      logInfo("Sunday service info sent successfully", { userId, chatId });
    }

    return result;
  } catch (error) {
    logWarn("Error in sunday service command", error);
    return {
      success: false,
      error: "Произошла ошибка при получении информации о воскресном служении",
    };
  }
};

const getNextSunday = (date: Date): Date => {
  const result = new Date(date);
  const dayOfWeek = result.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  result.setDate(result.getDate() + daysUntilSunday);
  return result;
};

const formatSundayServiceMessage = (services: any[], date: Date): string => {
  let message = `⛪ <b>Воскресное служение - ${formatDate(date)}</b>\n\n`;

  services.forEach((service, index) => {
    message += `${index + 1}. <b>${service.title}</b>\n`;
    if (service.description) {
      message += `   ${service.description}\n`;
    }
    message += "\n";
  });

  message += "Ждем вас на служении! 🙏";
  return message;
};
