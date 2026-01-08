import { ScheduleState, ScheduleFormData, WeeklyServiceItem, WeeklyScheduleInfo } from "../types";
import { formatWeeklyScheduleMessage } from "./weeklyScheduleFormatter";

// Types for inline keyboard
interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

/**
 * Build keyboard for mode selection (create/edit)
 */
export const buildModeKeyboard = (): InlineKeyboardMarkup => {
  return {
    inline_keyboard: [
      [
        { text: "➕ Создать новое", callback_data: "schedule:mode:create" },
        { text: "✏️ Редактировать", callback_data: "schedule:mode:edit" },
      ],
      [{ text: "❌ Отмена", callback_data: "schedule:cancel" }],
    ],
  };
};

/**
 * Build keyboard for date selection (for create mode)
 */
export const buildDateKeyboard = (): InlineKeyboardMarkup => {
  const today = new Date();
  const buttons: InlineKeyboardButton[][] = [];

  // Generate dates for next 14 days
  for (let i = 1; i <= 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    const formatDate = (date: Date): string => {
      return date.toLocaleDateString("ru-RU", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      });
    };

    // Add 2 dates per row
    if (i % 2 === 1) {
      const nextDate = new Date(today);
      nextDate.setDate(today.getDate() + i + 1);
      
      buttons.push([
        {
          text: `📅 ${formatDate(date)}`,
          callback_data: `schedule:date:${date.toISOString().split("T")[0]}`,
        },
        {
          text: `📅 ${formatDate(nextDate)}`,
          callback_data: `schedule:date:${nextDate.toISOString().split("T")[0]}`,
        },
      ]);
    }
  }

  buttons.push([{ text: "❌ Отмена", callback_data: "schedule:cancel" }]);

  return { inline_keyboard: buttons };
};

/**
 * Build keyboard for week selection (for edit mode)
 */
export const buildWeekSelectionKeyboard = (): InlineKeyboardMarkup => {
  return {
    inline_keyboard: [
      [
        { text: "📅 Текущая неделя", callback_data: "schedule:select_week:current" },
        { text: "📅 Следующая неделя", callback_data: "schedule:select_week:next" },
      ],
      [{ text: "❌ Отмена", callback_data: "schedule:cancel" }],
    ],
  };
};

/**
 * Build keyboard for week preview (after selecting week)
 */
export const buildWeekPreviewKeyboard = (): InlineKeyboardMarkup => {
  return {
    inline_keyboard: [
      [{ text: "✏️ Редактировать расписание", callback_data: "schedule:edit_week" }],
      [
        { text: "📅 Выбрать другую неделю", callback_data: "schedule:select_week" },
        { text: "❌ Отмена", callback_data: "schedule:cancel" },
      ],
    ],
  };
};

/**
 * Build keyboard for service selection (for edit mode)
 */
export const buildServiceSelectionKeyboard = (
  services: WeeklyServiceItem[]
): InlineKeyboardMarkup => {
  const buttons: InlineKeyboardButton[][] = [];

  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("ru-RU", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });
  };

  // Add services (one per row)
  services.forEach((service) => {
    const dateStr = formatDate(service.date);
    const title = service.title.length > 30 
      ? service.title.substring(0, 27) + "..." 
      : service.title;
    buttons.push([
      {
        text: `📅 ${dateStr} - ${title}`,
        callback_data: `schedule:select_service:${service.id}`,
      },
    ]);
  });

  if (services.length === 0) {
    buttons.push([
      {
        text: "Нет доступных служений",
        callback_data: "schedule:no_services",
      },
    ]);
  }

  buttons.push([{ text: "❌ Отмена", callback_data: "schedule:cancel" }]);

  return { inline_keyboard: buttons };
};

/**
 * Build keyboard for review and confirmation
 */
export const buildReviewKeyboard = (): InlineKeyboardMarkup => {
  return {
    inline_keyboard: [
      [{ text: "✅ Сохранить", callback_data: "schedule:confirm" }],
      [
        { text: "✏️ Изменить", callback_data: "schedule:edit" },
        { text: "❌ Отмена", callback_data: "schedule:cancel" },
      ],
    ],
  };
};

/**
 * Build keyboard for field selection during edit
 */
export const buildEditFieldKeyboard = (
  data: ScheduleFormData
): InlineKeyboardMarkup => {
  const buttons: InlineKeyboardButton[][] = [];

  buttons.push([
    { text: "📝 Название", callback_data: "schedule:edit:title" },
    { text: "📅 Дата", callback_data: "schedule:edit:date" },
  ]);
  buttons.push([
    { text: "✅ Сохранить", callback_data: "schedule:confirm" },
    { text: "❌ Отмена", callback_data: "schedule:cancel" },
  ]);

  return { inline_keyboard: buttons };
};

/**
 * Build keyboard with "Continue editing" button after successful save
 */
export const buildContinueEditingKeyboard = (): InlineKeyboardMarkup => {
  return {
    inline_keyboard: [
      [{ text: "✏️ Продолжить редактирование", callback_data: "schedule:continue_edit" }],
    ],
  };
};

/**
 * Format preview message for review
 */
export const formatPreviewMessage = (
  state: ScheduleState
): string => {
  const { data } = state;
  let message = "📋 <b>Предпросмотр данных</b>\n\n";

  message += `📅 <b>Дата:</b> ${data.date ? new Date(data.date).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }) : "не указана"}\n`;
  message += `📝 <b>Название:</b> ${data.title || "не указано"}\n`;

  return message;
};

/**
 * Format week preview message from services list
 */
export const formatWeekPreviewMessage = (
  services: WeeklyServiceItem[],
  weekType: "current" | "next"
): string => {
  const weekName = weekType === "current" ? "текущей" : "следующей";
  
  if (services.length === 0) {
    return `📅 <b>Расписание на ${weekName} неделю</b>\n\n❌ На эту неделю не запланировано служений.`;
  }

  // Calculate week start and end dates
  const today = new Date();
  let weekStart: Date;
  let weekEnd: Date;

  if (weekType === "current") {
    const currentDay = today.getDay();
    const daysToMonday = currentDay === 0 ? -6 : currentDay === 1 ? 0 : -(currentDay - 1);
    weekStart = new Date(today);
    weekStart.setDate(today.getDate() + daysToMonday);
    weekStart.setHours(0, 0, 0, 0);
    weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
  } else {
    const currentDay = today.getDay();
    const daysUntilMonday = currentDay === 0 ? 1 : currentDay === 1 ? 7 : 8 - currentDay;
    weekStart = new Date(today);
    weekStart.setDate(today.getDate() + daysUntilMonday);
    weekStart.setHours(0, 0, 0, 0);
    weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
  }

  // Create WeeklyScheduleInfo from services
  const scheduleInfo: WeeklyScheduleInfo = {
    startDate: weekStart,
    endDate: weekEnd,
    services: services,
  };

  // Use existing formatter but remove blessing and hashtag for preview
  const formatted = formatWeeklyScheduleMessage(scheduleInfo);
  // Remove blessing and hashtag from the end
  const withoutFooter = formatted.split("---\n\n")[0].trim();
  
  return `📅 <b>Расписание на ${weekName} неделю</b>\n\n${withoutFooter}`;
};

/**
 * Get message text for current step
 */
export const getStepMessage = (
  step: string,
  data: ScheduleFormData
): string => {
  switch (step) {
    case "mode":
      return "Выберите действие:";
    case "select_week":
      return "Выберите неделю для редактирования:";
    case "preview_week":
      return "Предпросмотр расписания:";
    case "date":
      return "Выберите дату служения:";
    case "select_service":
      return "Выберите служение для редактирования:";
    case "title":
      return "Введите название служения:";
    case "review":
      return formatPreviewMessage({
        userId: 0,
        chatId: 0,
        step: "review",
        data,
      });
    default:
      return "Продолжаем заполнение...";
  }
};

/**
 * Validate form data before saving
 */
export const validateFormData = (
  data: ScheduleFormData
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.date) {
    errors.push("Не указана дата служения");
  }

  if (!data.title || data.title.trim() === "") {
    errors.push("Не указано название служения");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

