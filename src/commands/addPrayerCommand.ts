import { CommandResult } from "../types";
import { sendMessage } from "../services/telegramService";
import { createWeeklyPrayerRecord } from "../services/notionService";
import { logInfo, logWarn } from "../utils/logger";
import {
  parsePrayerInput,
  createWeeklyPrayerInput,
  formatDateRange,
  getPrayerInputHelp,
} from "../utils/prayerInputParser";

export const executeAddPrayerCommand = async (
  userId: number,
  chatId: number,
  params: string[] = []
): Promise<CommandResult> => {
  logInfo("Executing add prayer command", { userId, chatId, params });

  // If no parameters, show help
  if (params.length === 0) {
    const helpMessage = getPrayerInputHelp();
    return await sendMessage(chatId, helpMessage, { parse_mode: "HTML" });
  }

  // Join all parameters into a single string
  const inputString = params.join(" ");

  try {
    // Parse the input
    const parseResult = parsePrayerInput(inputString);

    if (!parseResult.isValid || !parseResult.data) {
      return await sendMessage(
        chatId,
        `❌ ${parseResult.error}\n\n${getPrayerInputHelp()}`,
        { parse_mode: "HTML" }
      );
    }

    // Create prayer input object
    const prayerInput = createWeeklyPrayerInput(parseResult.data);

    // Save to Notion
    const result = await createWeeklyPrayerRecord(prayerInput);

    if (result.success) {
      const successMessage = `
✅ <b>Молитвенная запись успешно добавлена!</b>

🙏 <b>Молитвенное лицо:</b> ${prayerInput.person}
📝 <b>Тема:</b> ${prayerInput.topic}
${prayerInput.note ? `📌 <b>Примечание:</b> ${prayerInput.note}\n` : ""}
📅 <b>Период:</b> ${formatDateRange(prayerInput.dateStart, prayerInput.dateEnd)}
🗓️ <b>Неделя:</b> ${
        prayerInput.weekType === "current" ? "Текущая" : "Предстоящая"
      }

Запись сохранена в базе данных Notion.
`;

      logInfo("Prayer record added successfully", {
        userId,
        chatId,
        person: prayerInput.person,
        topic: prayerInput.topic,
        weekType: prayerInput.weekType,
      });

      return await sendMessage(chatId, successMessage, { parse_mode: "HTML" });
    } else {
      logWarn("Failed to add prayer record", { error: result.error });
      return await sendMessage(
        chatId,
        `❌ Ошибка при сохранении записи: ${result.error}\n\nПопробуйте еще раз или обратитесь к администратору.`
      );
    }
  } catch (error) {
    logWarn("Error in add prayer command", error);
    return await sendMessage(
      chatId,
      `❌ Произошла ошибка при обработке команды.\n\n${getPrayerInputHelp()}`,
      { parse_mode: "HTML" }
    );
  }
};
