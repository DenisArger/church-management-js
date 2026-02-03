import { CalendarItem } from "../types";
import { logInfo } from "./logger";

/**
 * Generate poll question text for youth service events
 */
const generateYouthServiceQuestion = (
  time: string,
  theme?: string
): string => {
  const templates = [
    theme
      ? `Молодежное служение завтра в ${time} 🎉 Тема: "${theme}" 📖 Придёшь?`
      : `Молодежное служение завтра в ${time} 🎉 Придёшь?`,
    theme
      ? `Молодежное завтра в ${time} ⏰ Тема: "${theme}" 📚 Будешь?`
      : `Молодежное завтра в ${time} ⏰ Будешь?`,
    theme
      ? `Молодежное служение завтра в ${time} 🙌 Тема: "${theme}" ✨ Придешь?`
      : `Молодежное служение завтра в ${time} 🙌 Придешь?`,
    theme
      ? `Молодежное завтра в ${time} 🎵 Тема: "${theme}" 💫 Придёшь?`
      : `Молодежное завтра в ${time} 🎵 Придёшь?`,
  ];

  const randomIndex = Math.floor(Math.random() * templates.length);
  return templates[randomIndex];
};

/**
 * Generate poll question text for МОСТ events
 */
const generateMostQuestion = (time: string): string => {
  const templates = [
    `Молодежное общение "МОСТ" завтра в ${time} 🌉 Придешь?`,
    `МОСТ завтра в ${time} 🌉 Придешь?`,
    `Молодежное общение МОСТ завтра в ${time} 💬 Будешь?`,
    `МОСТ завтра в ${time} 🤝 Будешь?`,
  ];

  const randomIndex = Math.floor(Math.random() * templates.length);
  return templates[randomIndex];
};

/**
 * Get random poll options
 */
const getRandomPollOptions = (): [string, string] => {
  const optionsSets: Array<[string, string]> = [
    ["Конечно, буду! 🔥", "К сожалению, меня не будет 😔"],
    ["Да, приду! ✅", "Не смогу прийти ❌"],
    ["Буду там! 🙌", "Не смогу 😢"],
    ["Конечно! 🎉", "Не получится 😞"],
    ["Буду! 💪", "Не смогу прийти 🚫"],
    ["Да, буду! ✨", "К сожалению нет 😕"],
    ["Приду! 🎯", "Не смогу ⏰"],
  ];

  const randomIndex = Math.floor(Math.random() * optionsSets.length);
  return optionsSets[randomIndex];
};

/**
 * Extract time from event date and format as HH:MM
 * Uses Moscow timezone to match Notion timezone
 * If date has no time (only date), uses default time (19:00 for youth events)
 */
const extractTimeFromEvent = (eventDate: Date): string => {
  // Check if date has no time component (only date, time is 00:00:00 UTC)
  // If hours, minutes, and seconds are all 0 in UTC, it's likely a date-only value
  const isDateOnly = eventDate.getUTCHours() === 0 && 
                     eventDate.getUTCMinutes() === 0 && 
                     eventDate.getUTCSeconds() === 0 &&
                     eventDate.getUTCMilliseconds() === 0;

  if (isDateOnly) {
    // Use default time 19:00 for youth events
    return "19:00";
  }

  // Format time in Moscow timezone
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  
  const parts = formatter.formatToParts(eventDate);
  const hours = parts.find(part => part.type === "hour")?.value || "00";
  const minutes = parts.find(part => part.type === "minute")?.value || "00";
  
  return `${hours}:${minutes}`;
};

/**
 * Determine event type from CalendarItem
 */
const getEventType = (event: CalendarItem): "youth" | "most" => {
  // Check serviceType from Notion first
  if (event.serviceType === "МОСТ") {
    return "most";
  }
  
  // Fallback: check if title or description contains "МОСТ"
  const title = event.title?.toUpperCase() || "";
  const description = event.description?.toUpperCase() || "";
  
  if (title.includes("МОСТ") || description.includes("МОСТ")) {
    return "most";
  }
  
  // Default to youth
  return "youth";
};

/**
 * Generate poll question and options for an event
 */
export const generatePollContent = (
  event: CalendarItem
): { question: string; options: [string, string] } => {
  const time = extractTimeFromEvent(event.date);
  const eventType = getEventType(event);
  const youthTheme = event.theme || event.title;

  let question: string;

  if (eventType === "most") {
    question = generateMostQuestion(time);
  } else {
    question = generateYouthServiceQuestion(time, youthTheme);
  }

  const options = getRandomPollOptions();

  logInfo("Generated poll content", {
    eventId: event.id,
    eventType,
    time,
    hasTheme: !!event.theme,
    question,
    options,
  });

  return { question, options };
};

