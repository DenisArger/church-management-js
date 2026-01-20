import { CommandResult } from "../types";
import type { SundayServiceState } from "../types";
import { sendMessage } from "../services/telegramService";
import {
  getSundayServiceByDate,
  createSundayService,
  updateSundayService,
} from "../services/calendarService";
import { formatDateForNotion } from "../utils/dateHelper";
import {
  getUserState,
  updateStateData,
  updateStep,
  setWaitingForTextInput,
  getCurrentStream,
  saveCurrentStreamData,
} from "../utils/sundayServiceState";
import {
  getStepMessage,
  buildReviewKeyboard,
} from "../utils/sundayServiceFormBuilder";
import { parseScriptureSchedule, ParsedScheduleEntry } from "../utils/scriptureScheduleParser";
import { logInfo, logWarn } from "../utils/logger";

/**
 * Process single schedule entry - update or create Sunday service
 */
const processScheduleEntry = async (
  entry: ParsedScheduleEntry,
  stream: "1" | "2"
): Promise<{ success: boolean; updated: boolean; created: boolean }> => {
  try {
    const reader = stream === "1" ? entry.stream1Reader : entry.stream2Reader;

    logInfo("Processing schedule entry", {
      date: formatDateForNotion(entry.date),
      dateISO: entry.date.toISOString(),
      stream,
      scriptureReading: entry.scriptureReading,
      reader,
    });

    const existingService = await getSundayServiceByDate(entry.date, stream);

    if (existingService) {
      logInfo("Service exists, updating", {
        serviceId: existingService.id,
        date: formatDateForNotion(entry.date),
        stream,
      });

      const updateData: import("../types").SundayServiceFormData = {
        scriptureReading: entry.scriptureReading,
        mode: "edit",
        stream: stream,
      };
      updateData.scriptureReader = reader !== undefined ? (reader || undefined) : undefined;

      logInfo("Updating service with data", {
        serviceId: existingService.id,
        stream,
        scriptureReading: updateData.scriptureReading,
        reader,
        updateData: {
          scriptureReading: updateData.scriptureReading,
          scriptureReader: updateData.scriptureReader,
        },
      });

      const result = await updateSundayService(
        existingService.id,
        updateData,
        stream
      );

      if (!result.success) {
        logWarn("Failed to update service", {
          error: result.error,
          serviceId: existingService.id,
          stream,
          updateData,
        });
      } else {
        logInfo("Service updated successfully", {
          serviceId: existingService.id,
          stream,
        });
      }

      return {
        success: result.success,
        updated: result.success,
        created: false,
      };
    } else {
      logInfo("Service does not exist, creating", {
        date: formatDateForNotion(entry.date),
        dateISO: entry.date.toISOString(),
        stream,
      });

      const createData: import("../types").SundayServiceFormData = {
        date: entry.date,
        scriptureReading: entry.scriptureReading,
        mode: "create",
        stream: stream,
      };
      if (reader) {
        createData.scriptureReader = reader;
      }

      const result = await createSundayService(createData, stream);

      if (!result.success) {
        logWarn("Failed to create service", {
          error: result.error,
          date: formatDateForNotion(entry.date),
          stream,
          createData,
        });
      } else {
        logInfo("Service created successfully", {
          date: formatDateForNotion(entry.date),
          stream,
          pageId: result.data?.pageId,
        });
      }

      return {
        success: result.success,
        updated: false,
        created: result.success,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logWarn("Error processing schedule entry", {
      error: errorMessage,
      errorStack,
      entry: {
        date: entry.date.toISOString(),
        scriptureReading: entry.scriptureReading,
        stream1Reader: entry.stream1Reader,
        stream2Reader: entry.stream2Reader,
      },
      stream,
    });
    return { success: false, updated: false, created: false };
  }
};

/**
 * Handle schedule for selected date in form
 */
const handleSelectedDateSchedule = async (
  userId: number,
  chatId: number,
  schedule: ParsedScheduleEntry[],
  state: SundayServiceState | undefined
): Promise<CommandResult> => {
  if (!state || !state.data.date) {
    return { success: false, error: "State or date not found" };
  }

  let targetStream: "1" | "2";
  if (state.data.stream === "both") {
    const currentStream = getCurrentStream(state);
    if (!currentStream) {
      return await sendMessage(
        chatId,
        "❌ Не выбран поток. Выберите поток для заполнения.",
        { parse_mode: "HTML" }
      );
    }
    targetStream = currentStream;
  } else if (state.data.stream === "1" || state.data.stream === "2") {
    targetStream = state.data.stream;
  } else {
    return await sendMessage(
      chatId,
      "❌ Не выбран поток. Выберите поток для заполнения.",
      { parse_mode: "HTML" }
    );
  }

  const normalizedTarget = new Date(state.data.date);
  normalizedTarget.setHours(0, 0, 0, 0);

  const entry = schedule.find((e) => {
    const normalizedEntry = new Date(e.date);
    normalizedEntry.setHours(0, 0, 0, 0);
    return normalizedEntry.getTime() === normalizedTarget.getTime();
  });

  if (!entry) {
    return await sendMessage(
      chatId,
      "❌ Не найдена соответствующая запись в графике для выбранной даты.",
      { parse_mode: "HTML" }
    );
  }

  const updates: Partial<typeof state.data> = {
    scriptureReading: entry.scriptureReading,
  };
  const reader =
    targetStream === "1" ? entry.stream1Reader : entry.stream2Reader;
  if (reader) {
    updates.scriptureReader = reader;
  }

  if (state.data.stream === "both") {
    await saveCurrentStreamData(userId);
  }

  await updateStateData(userId, updates);
  await setWaitingForTextInput(userId, false);
  await updateStep(userId, "review");

  const updatedState = await getUserState(userId);
  if (!updatedState) {
    return { success: false, error: "State not found after update" };
  }

  const reviewMessage = getStepMessage("review", updatedState.data);
  const infoMessage = `✅ <b>Данные автоматически заполнены из графика!</b>\n\n${reviewMessage}`;
  const reviewKeyboard = buildReviewKeyboard();

  logInfo("Auto-filled scripture data from schedule", {
    userId,
    date: state.data.date,
    stream: targetStream,
    scriptureReading: entry.scriptureReading,
    reader,
  });

  return await sendMessage(chatId, infoMessage, {
    reply_markup: reviewKeyboard,
    parse_mode: "HTML",
  });
};

/**
 * Handle schedule for all dates - update/create services in Notion
 */
const handleAllDatesSchedule = async (
  userId: number,
  chatId: number,
  schedule: ParsedScheduleEntry[]
): Promise<CommandResult> => {
  let processed = 0;
  let updated = 0;
  let created = 0;
  let errors = 0;

  for (const entry of schedule) {
    if (entry.scriptureReading) {
      const result = await processScheduleEntry(entry, "1");
      processed++;
      if (result.success) {
        if (result.updated) updated++;
        if (result.created) created++;
      } else {
        errors++;
      }
    }
    if (entry.scriptureReading) {
      const result = await processScheduleEntry(entry, "2");
      processed++;
      if (result.success) {
        if (result.updated) updated++;
        if (result.created) created++;
      } else {
        errors++;
      }
    }
  }

  let message = `✅ <b>График обработан!</b>\n\n`;
  message += `📅 Обработано записей: ${processed}\n`;
  if (created > 0) {
    message += `➕ Создано новых: ${created}\n`;
  }
  if (updated > 0) {
    message += `✏️ Обновлено существующих: ${updated}\n`;
  }
  if (errors > 0) {
    message += `❌ Ошибок: ${errors}\n`;
  }

  logInfo("Processed all schedule entries", {
    userId,
    processed,
    created,
    updated,
    errors,
  });

  return await sendMessage(chatId, message, { parse_mode: "HTML" });
};

/**
 * Handle forwarded message or message with scripture schedule.
 * If date is selected in form - process only that date.
 * Otherwise - process all dates from schedule.
 */
export const handleScriptureScheduleMessage = async (
  userId: number,
  chatId: number,
  text: string
): Promise<CommandResult> => {
  try {
    const schedule = parseScriptureSchedule(text);
    if (schedule.length === 0) {
      logInfo("No schedule entries found in message", { userId });
      return await sendMessage(
        chatId,
        "❌ Не удалось распарсить график. Проверьте формат сообщения.",
        { parse_mode: "HTML" }
      );
    }

    const state = await getUserState(userId);
    const hasSelectedDate = state && state.data.date;

    if (hasSelectedDate) {
      return await handleSelectedDateSchedule(userId, chatId, schedule, state!);
    } else {
      return await handleAllDatesSchedule(userId, chatId, schedule);
    }
  } catch (error) {
    logWarn("Error handling scripture schedule message", error);
    return {
      success: false,
      error: "Произошла ошибка при обработке графика",
    };
  }
};
