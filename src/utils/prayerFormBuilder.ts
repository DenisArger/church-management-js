import { PrayerFormData, PrayerFormStep } from "../types";
import { PrayerPersonInfo } from "./messageFormatter";

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
 * Build keyboard for week selection
 */
export const buildWeekSelectionKeyboard = (): InlineKeyboardMarkup => {
  return {
    inline_keyboard: [
      [
        { text: "📅 Текущая неделя", callback_data: "prayer:week:current" },
        { text: "📅 Следующая неделя", callback_data: "prayer:week:next" },
      ],
      [{ text: "❌ Отмена", callback_data: "prayer:cancel" }],
    ],
  };
};

/**
 * Build keyboard for person selection
 * Shows up to 5 people who haven't been prayed for recently + "Add new" button
 */
export const buildPersonSelectionKeyboard = (
  people: PrayerPersonInfo[]
): InlineKeyboardMarkup => {
  const buttons: InlineKeyboardButton[][] = [];

  // Add buttons for people (up to 5)
  // Use index to avoid callback_data length limit (64 bytes)
  const peopleButtons: InlineKeyboardButton[] = [];
  for (let i = 0; i < Math.min(people.length, 5); i++) {
    const person = people[i];
    // Truncate name if too long for button text (max ~30 chars for readability)
    const buttonText = person.person.length > 30 
      ? `${person.person.substring(0, 27)}...` 
      : person.person;
    peopleButtons.push({
      text: `🙏 ${buttonText}`,
      callback_data: `prayer:person:idx:${i}`,
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

  // Add "Add new person" button
  buttons.push([
    { text: "➕ Добавить нового человека", callback_data: "prayer:person:new" },
  ]);

  // Add cancel button
  buttons.push([{ text: "❌ Отмена", callback_data: "prayer:cancel" }]);

  return {
    inline_keyboard: buttons,
  };
};

/**
 * Get message for current step
 */
export const getStepMessage = (
  step: PrayerFormStep,
  data: PrayerFormData,
  _people?: PrayerPersonInfo[]
): string => {
  switch (step) {
    case "week":
      return `📅 <b>Выберите неделю для молитвы</b>\n\nНа какую неделю вы хотите добавить молитвенную запись?`;

    case "person":
      if (data.weekType) {
        const weekText = data.weekType === "current" ? "текущую" : "следующую";
        return `🙏 <b>Выберите человека</b>\n\nВыберите человека для ${weekText} недели или добавьте нового:`;
      }
      return `🙏 <b>Выберите человека</b>\n\nВыберите человека для молитвы:`;

    case "topic":
      if (data.person) {
        return `📝 <b>Введите тему молитвы</b>\n\nВыберите действие для <b>${data.person}</b>:\n\n<i>Минимум 3 символа</i>`;
      }
      return `📝 <b>Введите тему молитвы</b>\n\nВыберите действие:\n\n<i>Минимум 3 символа</i>`;

    case "completed":
      return `✅ <b>Молитвенная запись успешно добавлена!</b>`;

    default:
      return "";
  }
};

/**
 * Build review message before confirmation
 */
export const buildReviewMessage = (data: PrayerFormData): string => {
  const weekText = data.weekType === "current" ? "Текущая" : "Предстоящая";
  return `
✅ <b>Проверьте данные перед сохранением:</b>

🙏 <b>Молитвенное лицо:</b> ${data.person}
📝 <b>Тема:</b> ${data.topic}
📅 <b>Неделя:</b> ${weekText}

Сохранить запись?
`;
};

/**
 * Build keyboard for topic input with options to use previous week's topics
 */
export const buildTopicInputKeyboard = (
  _previousTopics: Array<{ topic: string; date: Date }>
): InlineKeyboardMarkup => {
  const buttons: InlineKeyboardButton[][] = [];

  // Add button to copy last topic from previous week (always show)
  buttons.push([
    { text: "📋 Скопировать тему прошлой недели", callback_data: "prayer:topic:copy_last" },
  ]);

  // Add button to add new topic
  buttons.push([
    { text: "➕ Добавить новую тему", callback_data: "prayer:topic:new" },
  ]);

  // Add cancel button
  buttons.push([
    { text: "❌ Отмена", callback_data: "prayer:cancel" },
  ]);

  return {
    inline_keyboard: buttons,
  };
};

/**
 * Build keyboard for selecting topic from previous week
 */
export const buildPreviousTopicsKeyboard = (
  previousTopics: Array<{ topic: string; date: Date }>
): InlineKeyboardMarkup => {
  const buttons: InlineKeyboardButton[][] = [];

  // Add buttons for each previous topic (up to 5 most recent)
  const topicsToShow = previousTopics.slice(-5).reverse(); // Show 5 most recent, newest first
  for (let i = 0; i < topicsToShow.length; i++) {
    const topicItem = topicsToShow[i];
    const topicText = topicItem.topic.length > 35 
      ? `${topicItem.topic.substring(0, 32)}...` 
      : topicItem.topic;
    // Use index in original array (before reverse)
    const originalIndex = previousTopics.length - 1 - i;
    buttons.push([
      { 
        text: `📝 ${topicText}`, 
        callback_data: `prayer:topic:previous:idx:${originalIndex}` 
      },
    ]);
  }

  // Add back button
  buttons.push([
    { text: "⬅️ Назад", callback_data: "prayer:topic:back" },
  ]);

  return {
    inline_keyboard: buttons,
  };
};

/**
 * Build confirmation keyboard
 */
export const buildConfirmationKeyboard = (): InlineKeyboardMarkup => {
  return {
    inline_keyboard: [
      [
        { text: "✅ Сохранить", callback_data: "prayer:confirm" },
        { text: "❌ Отмена", callback_data: "prayer:cancel" },
      ],
    ],
  };
};

