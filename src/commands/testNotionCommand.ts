import { CommandResult } from "../types";
import { sendMessage } from "../services/telegramService";
import {
  getNotionClient,
  getActivePrayerNeeds,
  getDailyScripture,
} from "../services/notionService";
import { logInfo, logError } from "../utils/logger";

export const executeTestNotionCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult> => {
  logInfo("Executing test notion command", { userId, chatId });

  try {
    const testResults = await performNotionTests();
    const message = formatTestResults(testResults);

    const result = await sendMessage(chatId, message, { parse_mode: "HTML" });

    if (result.success) {
      logInfo("Notion test results sent successfully", { userId, chatId });
    }

    return result;
  } catch (error) {
    logError("Error in test notion command", error);
    return {
      success: false,
      error: "Произошла ошибка при тестировании подключения к Notion",
    };
  }
};

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  details?: string;
}

const performNotionTests = async (): Promise<TestResult[]> => {
  const results: TestResult[] = [];

  // Test 1: Client initialization
  try {
    getNotionClient();
    results.push({
      test: "Инициализация клиента",
      success: true,
      message: "✅ Клиент Notion успешно инициализирован",
    });
  } catch (error) {
    results.push({
      test: "Инициализация клиента",
      success: false,
      message: "❌ Ошибка инициализации клиента Notion",
      details: error instanceof Error ? error.message : "Неизвестная ошибка",
    });
    return results; // If client init fails, other tests won't work
  }

  // Test 2: Prayer needs database access
  try {
    const prayerNeeds = await getActivePrayerNeeds();
    results.push({
      test: "База данных молитвенных нужд",
      success: true,
      message: `✅ Успешно получено ${prayerNeeds.length} активных молитвенных нужд`,
    });
  } catch (error) {
    results.push({
      test: "База данных молитвенных нужд",
      success: false,
      message: "❌ Ошибка доступа к базе данных молитвенных нужд",
      details: error instanceof Error ? error.message : "Неизвестная ошибка",
    });
  }

  // Test 3: Daily scripture database access
  try {
    const scripture = await getDailyScripture();
    if (scripture) {
      results.push({
        test: "База данных ежедневного чтения",
        success: true,
        message: "✅ Успешно получено ежедневное чтение",
        details: `День ${scripture.dayNumber ?? "нет данных"}: Ветхий Завет — ${scripture.oldTestament || "нет данных"}, Новый Завет — ${scripture.newTestament || "нет данных"}`,
      });
    } else {
      results.push({
        test: "База данных ежедневного чтения",
        success: true,
        message: "✅ База данных доступна, но на сегодня нет чтения",
      });
    }
  } catch (error) {
    results.push({
      test: "База данных ежедневного чтения",
      success: false,
      message: "❌ Ошибка доступа к базе данных ежедневного чтения",
      details: error instanceof Error ? error.message : "Неизвестная ошибка",
    });
  }

  // Test 4: Weekly prayer database access
  try {
    const { getWeeklyPrayerRecords } = await import(
      "../services/notionService"
    );
    const weeklyPrayers = await getWeeklyPrayerRecords();
    results.push({
      test: "База данных недельных молитв",
      success: true,
      message: `✅ Успешно получено ${weeklyPrayers.length} записей недельных молитв`,
    });
  } catch (error) {
    results.push({
      test: "База данных недельных молитв",
      success: false,
      message: "❌ Ошибка доступа к базе данных недельных молитв",
      details: error instanceof Error ? error.message : "Неизвестная ошибка",
    });
  }

  return results;
};

const formatTestResults = (results: TestResult[]): string => {
  let message = "🔧 <b>Результаты тестирования подключения к Notion</b>\n\n";

  const successfulTests = results.filter((r) => r.success).length;
  const totalTests = results.length;

  message += `📊 <b>Общий результат:</b> ${successfulTests}/${totalTests} тестов пройдено успешно\n\n`;

  results.forEach((result, index) => {
    message += `<b>${index + 1}. ${result.test}</b>\n`;
    message += `${result.message}\n`;

    if (result.details) {
      message += `<i>Детали: ${result.details}</i>\n`;
    }

    message += "\n";
  });

  if (successfulTests === totalTests) {
    message +=
      "🎉 <b>Все тесты пройдены успешно! Подключение к Notion работает корректно.</b>";
  } else {
    message +=
      "⚠️ <b>Обнаружены проблемы с подключением к Notion. Проверьте настройки.</b>";
  }

  return message;
};
