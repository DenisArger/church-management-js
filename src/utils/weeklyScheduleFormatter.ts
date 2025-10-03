import { WeeklyScheduleInfo } from "../types";
import { logInfo } from "./logger";
import { getRandomBlessing, formatBlessing } from "./blessingGenerator";

/**
 * Format weekly schedule information for display
 * Creates a beautiful message with emojis and proper formatting
 */
export const formatWeeklyScheduleMessage = (
  scheduleInfo: WeeklyScheduleInfo | null
): string => {
  if (!scheduleInfo || scheduleInfo.services.length === 0) {
    return `🌟 <b>Расписание служений</b> 🌟\n💥<b>Предстоящая неделя</b> 💥\n\n📅 К сожалению, на эту неделю не запланировано служений для рассылки.\n\n🙌 Благословенной недели! 🙏\n#расписаниеслужений`;
  }

  const { startDate, endDate, services } = scheduleInfo;

  // Format date range
  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);
  const weekRange = `${startDateStr} - ${endDateStr}`;

  logInfo("Formatting weekly schedule", {
    servicesCount: services.length,
    weekRange,
  });

  let message = `🌟 <b>Расписание служений</b> 🌟\n💥<b>Неделя с ${startDateStr} по ${endDateStr}</b> 💥\n\n`;

  // Group services by date
  const servicesByDate = groupServicesByDate(services);

  // Format each day
  for (const [dateStr, dayServices] of servicesByDate) {
    const date = new Date(dateStr);
    const dayName = getDayName(date);
    const formattedDate = formatDate(date);

    message += `<b>${dayName}, ${formattedDate}</b>\n`;

    for (const service of dayServices) {
      message += formatService(service);
    }

    message += "\n";
  }

  // Add random blessing and hashtag
  message += "---\n\n";
  const blessing = getRandomBlessing();
  message += formatBlessing(blessing) + "\n\n";
  message += `🙌 Благословенной недели! 🙏\n`;
  message += `#расписаниеслужений`;

  return message;
};

/**
 * Format individual service
 */
const formatService = (service: any): string => {
  let serviceText = "";

  // Add time if available
  if (service.time) {
    serviceText += `🕖 ${service.time} — `;
  }

  // Add service title
  serviceText += `${service.title}\n`;

  // Add description if available
  if (service.description) {
    serviceText += `💬 ${service.description}\n`;
  }

  // Add location if available
  if (service.location) {
    serviceText += `📍 Место проведения: ${service.location}\n`;
  }

  serviceText += "\n";
  return serviceText;
};

/**
 * Group services by date
 */
const groupServicesByDate = (services: any[]): Map<string, any[]> => {
  const grouped = new Map<string, any[]>();

  for (const service of services) {
    const dateStr = service.date.toISOString().split("T")[0];

    if (!grouped.has(dateStr)) {
      grouped.set(dateStr, []);
    }

    grouped.get(dateStr)!.push(service);
  }

  return grouped;
};

/**
 * Format date in Russian format
 */
const formatDate = (date: Date): string => {
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

/**
 * Get day name in Russian
 */
const getDayName = (date: Date): string => {
  const dayNames = [
    "Воскресенье",
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота",
  ];

  return dayNames[date.getDay()];
};
