import { WeeklyPrayerInput } from "../types";

export interface ParsedPrayerInput {
  person: string;
  topic: string;
  note?: string;
  weekType: "current" | "next";
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  data?: ParsedPrayerInput;
}

/**
 * Parses prayer input from user message
 * Expected format: "person | topic | weekType?"
 * Example: "Иван Петров | Здоровье | current"
 */
export const parsePrayerInput = (input: string): ValidationResult => {
  if (!input || input.trim().length === 0) {
    return {
      isValid: false,
      error:
        "Пустой ввод. Используйте формат: 'Имя | Тема | Неделя (current/next)'",
    };
  }

  const parts = input.split("|").map((part) => part.trim());

  if (parts.length < 2) {
    return {
      isValid: false,
      error:
        "Неверный формат. Используйте: 'Имя | Тема | Неделя (current/next)'",
    };
  }

  const person = parts[0];
  const topic = parts[1];
  const weekTypeRaw = parts[2]?.toLowerCase() || "current";

  // Validate person
  if (!person || person.length < 2) {
    return {
      isValid: false,
      error: "Имя человека должно содержать минимум 2 символа",
    };
  }

  // Validate topic
  if (!topic || topic.length < 3) {
    return {
      isValid: false,
      error: "Тема молитвы должна содержать минимум 3 символа",
    };
  }

  // Validate week type
  if (weekTypeRaw !== "current" && weekTypeRaw !== "next") {
    return {
      isValid: false,
      error:
        "Тип недели должен быть 'current' (текущая) или 'next' (предстоящая)",
    };
  }

  const weekType = weekTypeRaw as "current" | "next";

  return {
    isValid: true,
    data: {
      person,
      topic,
      note: "", // Always empty as requested
      weekType,
    },
  };
};

/**
 * Calculates date range for the specified week type
 * Week starts on Monday and ends on Sunday
 */
export const calculateWeekDates = (
  weekType: "current" | "next"
): { start: Date; end: Date } => {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

  console.log("=== DEBUG: calculateWeekDates ===");
  console.log("Current date:", now.toISOString());
  console.log("Current day of week:", currentDay, "(0=Sunday, 1=Monday, etc.)");

  // Calculate Monday of current week
  // If it's Sunday (0), go back 6 days to get Monday
  // If it's Monday (1), no offset needed
  // If it's Tuesday (2), go back 1 day to get Monday
  // etc.
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  console.log("Monday offset:", mondayOffset);

  const currentMonday = new Date(now);
  currentMonday.setDate(now.getDate() + mondayOffset);
  currentMonday.setHours(0, 0, 0, 0);

  // Calculate Sunday of current week (6 days after Monday)
  const currentSunday = new Date(currentMonday);
  currentSunday.setDate(currentMonday.getDate() + 6);
  currentSunday.setHours(23, 59, 59, 999);

  console.log("Current Monday:", currentMonday.toISOString());
  console.log("Current Sunday:", currentSunday.toISOString());

  if (weekType === "current") {
    console.log("Returning current week:", {
      start: currentMonday.toISOString(),
      end: currentSunday.toISOString(),
    });
    return {
      start: currentMonday,
      end: currentSunday,
    };
  } else {
    // Next week
    const nextMonday = new Date(currentMonday);
    nextMonday.setDate(currentMonday.getDate() + 7);

    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    nextSunday.setHours(23, 59, 59, 999);

    console.log("Next Monday:", nextMonday.toISOString());
    console.log("Next Sunday:", nextSunday.toISOString());
    console.log("Returning next week:", {
      start: nextMonday.toISOString(),
      end: nextSunday.toISOString(),
    });

    return {
      start: nextMonday,
      end: nextSunday,
    };
  }
};

/**
 * Formats date range for display
 */
export const formatDateRange = (start: Date, end: Date): string => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return `${formatDate(start)} - ${formatDate(end)}`;
};

/**
 * Creates WeeklyPrayerInput from parsed data
 */
export const createWeeklyPrayerInput = (
  parsed: ParsedPrayerInput
): WeeklyPrayerInput => {
  const dates = calculateWeekDates(parsed.weekType);

  return {
    person: parsed.person,
    topic: parsed.topic,
    note: parsed.note,
    weekType: parsed.weekType,
    dateStart: dates.start,
    dateEnd: dates.end,
  };
};

/**
 * Generates help message for prayer input format
 */
export const getPrayerInputHelp = (): string => {
  return `
📝 <b>Формат ввода молитвенной информации:</b>

<b>Синтаксис:</b>
<code>Имя | Тема | Неделя (current/next)</code>

<b>Примеры:</b>
• <code>Иван Петров | Здоровье | current</code>
• <code>Мария Сидорова | Работа | next</code>
• <code>Алексей Козлов | Семья | current</code>

<b>Параметры:</b>
• <b>Имя</b> - имя человека (минимум 2 символа)
• <b>Тема</b> - тема молитвы (минимум 3 символа)
• <b>Неделя</b> - <code>current</code> (текущая) или <code>next</code> (предстоящая)

<b>Типы недель:</b>
• <code>current</code> - текущая неделя (понедельник - воскресенье)
• <code>next</code> - предстоящая неделя

<b>Примечание:</b> Разделитель - символ "|" (вертикальная черта)
`;
};
