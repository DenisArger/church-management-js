import { YouthReportFormData, YouthReportFormStep } from "../types";

// Types for inline keyboard
interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

// Predefined communication types
export const COMMUNICATION_TYPES = [
  "Общение до/после служения",
  "Общение в соцсетях/мессенджерах",
  "Общение на домашнем общении",
  "Посещение (встреча)",
  "Не пообщался",
  "Другое",
];

// Predefined event types
export const EVENT_TYPES = [
  "Воскресное служение",
  "Домашнее общение",
  "Молодежное служение",
  "Молитвенное служение",
  "Другое",
];

/**
 * Build keyboard for person selection
 */
export const buildPersonSelectionKeyboard = (
  people: string[]
): InlineKeyboardMarkup => {
  const buttons: InlineKeyboardButton[][] = [];

  // Add buttons for people (up to 10)
  const peopleButtons: InlineKeyboardButton[] = [];
  for (let i = 0; i < Math.min(people.length, 10); i++) {
    const person = people[i];
    // Truncate name if too long for button text
    const buttonText = person.length > 30 
      ? `${person.substring(0, 27)}...` 
      : person;
    peopleButtons.push({
      text: `👤 ${buttonText}`,
      callback_data: `youth_report:person:idx:${i}`,
    });
  }

  // Add people buttons in rows of 2
  for (let i = 0; i < peopleButtons.length; i += 2) {
    if (i + 1 < peopleButtons.length) {
      buttons.push([peopleButtons[i], peopleButtons[i + 1]]);
    } else {
      buttons.push([peopleButtons[i]]);
    }
  }

  // Add cancel button
  buttons.push([{ text: "❌ Отмена", callback_data: "youth_report:cancel" }]);

  return {
    inline_keyboard: buttons,
  };
};

/**
 * Build keyboard for communication types selection (multi-select)
 * Uses index instead of full name to avoid callback_data length limit (64 bytes)
 */
export const buildCommunicationKeyboard = (
  selectedTypes: string[] = []
): InlineKeyboardMarkup => {
  const buttons: InlineKeyboardButton[][] = [];

  // Add communication type buttons
  COMMUNICATION_TYPES.forEach((type, index) => {
    const isSelected = selectedTypes.includes(type);
    buttons.push([
      {
        text: isSelected ? `✅ ${type}` : type,
        callback_data: `youth_report:comm:idx:${index}`,
      },
    ]);
  });

  // Add action buttons
  buttons.push([
    { text: "✅ Готово", callback_data: "youth_report:comm:done" },
    { text: "❌ Отмена", callback_data: "youth_report:cancel" },
  ]);

  return { inline_keyboard: buttons };
};

/**
 * Build keyboard for events selection (multi-select)
 * Uses index instead of full name to avoid callback_data length limit (64 bytes)
 */
export const buildEventsKeyboard = (
  selectedEvents: string[] = []
): InlineKeyboardMarkup => {
  const buttons: InlineKeyboardButton[][] = [];

  // Add event type buttons
  EVENT_TYPES.forEach((event, index) => {
    const isSelected = selectedEvents.includes(event);
    buttons.push([
      {
        text: isSelected ? `✅ ${event}` : event,
        callback_data: `youth_report:events:idx:${index}`,
      },
    ]);
  });

  // Add action buttons
  buttons.push([
    { text: "✅ Готово", callback_data: "youth_report:events:done" },
    { text: "❌ Отмена", callback_data: "youth_report:cancel" },
  ]);

  return { inline_keyboard: buttons };
};

/**
 * Build keyboard for review and confirmation
 */
export const buildReviewKeyboard = (): InlineKeyboardMarkup => {
  return {
    inline_keyboard: [
      [{ text: "✅ Сохранить", callback_data: "youth_report:confirm" }],
      [
        { text: "✏️ Изменить", callback_data: "youth_report:edit" },
        { text: "❌ Отмена", callback_data: "youth_report:cancel" },
      ],
    ],
  };
};

/**
 * Build keyboard for field selection during edit
 */
export const buildEditFieldKeyboard = (
  data: YouthReportFormData
): InlineKeyboardMarkup => {
  const buttons: InlineKeyboardButton[][] = [];

  buttons.push([
    { text: "👤 Человек", callback_data: "youth_report:edit:person" },
    { text: "💬 Общение", callback_data: "youth_report:edit:communication" },
  ]);
  buttons.push([
    { text: "📅 Мероприятия", callback_data: "youth_report:edit:events" },
    { text: "🆘 Помощь", callback_data: "youth_report:edit:help" },
  ]);
  buttons.push([
    { text: "📝 Примечание", callback_data: "youth_report:edit:note" },
  ]);
  buttons.push([
    { text: "✅ Сохранить", callback_data: "youth_report:confirm" },
    { text: "❌ Отмена", callback_data: "youth_report:cancel" },
  ]);

  return { inline_keyboard: buttons };
};

/**
 * Get message text for current step
 */
export const getStepMessage = (
  step: YouthReportFormStep,
  data: YouthReportFormData
): string => {
  switch (step) {
    case "person":
      return `👤 <b>О ком будет информация?</b>\n\nВыберите человека из списка закрепленных за вами:`;

    case "communication":
      if (data.person) {
        return `💬 <b>Как вы пообщались в течение 2-х недель?</b>\n\nВыберите способы общения с <b>${data.person}</b> (можно несколько):`;
      }
      return `💬 <b>Как вы пообщались в течение 2-х недель?</b>\n\nВыберите способы общения (можно несколько):`;

    case "events":
      if (data.person) {
        return `📅 <b>Какие церковные мероприятия посетил человек в течение 2-х недель?</b>\n\nВыберите мероприятия для <b>${data.person}</b> (можно несколько):`;
      }
      return `📅 <b>Какие церковные мероприятия посетил человек в течение 2-х недель?</b>\n\nВыберите мероприятия (можно несколько):`;

    case "help":
      if (data.person) {
        return `🆘 <b>В чем нужна помощь этому человеку?</b>\n\nВведите информацию о нужной помощи для <b>${data.person}</b>:\n\n<i>Можно оставить пустым</i>`;
      }
      return `🆘 <b>В чем нужна помощь этому человеку?</b>\n\nВведите информацию о нужной помощи:\n\n<i>Можно оставить пустым</i>`;

    case "note":
      if (data.person) {
        return `📝 <b>Примечание</b>\n\nВозможные дополнения к ранее написанному для <b>${data.person}</b>:\n\n<i>Можно оставить пустым</i>`;
      }
      return `📝 <b>Примечание</b>\n\nВозможные дополнения к ранее написанному:\n\n<i>Можно оставить пустым</i>`;

    case "review":
      return formatPreviewMessage(data);

    case "completed":
      return `✅ <b>Отчет успешно сохранен!</b>`;

    default:
      return "Продолжаем заполнение...";
  }
};

/**
 * Format preview message for review
 */
export const formatPreviewMessage = (
  data: YouthReportFormData
): string => {
  let message = "📋 <b>Предпросмотр данных</b>\n\n";

  message += `👤 <b>Человек:</b> ${data.person || "не выбран"}\n`;
  message += `💬 <b>Способы общения:</b> ${
    data.communicationTypes && data.communicationTypes.length > 0
      ? data.communicationTypes.join(", ")
      : "не указаны"
  }\n`;
  if (data.communicationOther) {
    message += `   └ Другое: ${data.communicationOther}\n`;
  }
  message += `📅 <b>Мероприятия:</b> ${
    data.events && data.events.length > 0
      ? data.events.join(", ")
      : "не указаны"
  }\n`;
  if (data.eventsOther) {
    message += `   └ Другое: ${data.eventsOther}\n`;
  }
  message += `🆘 <b>Помощь:</b> ${data.help || "не указана"}\n`;
  message += `📝 <b>Примечание:</b> ${data.note || "не указано"}\n`;

  return message;
};

/**
 * Validate form data before saving
 */
export const validateFormData = (
  data: YouthReportFormData
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.person || data.person.trim() === "") {
    errors.push("Не выбран человек");
  }

  if (!data.communicationTypes || data.communicationTypes.length === 0) {
    errors.push("Не указаны способы общения");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Get person name by index from people array
 */
export const getPersonByIndex = (
  index: number,
  people: string[]
): string | undefined => {
  if (index >= 0 && index < people.length) {
    return people[index];
  }
  return undefined;
};

