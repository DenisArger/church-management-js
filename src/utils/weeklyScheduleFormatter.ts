import { WeeklyScheduleInfo } from "../types";
import { logInfo } from "./logger";
import { getRandomBlessing, formatBlessing } from "./blessingGenerator";
import { formatDateForNotion } from "./dateHelper";

/**
 * Format weekly schedule information for display
 * Creates a beautiful message with emojis and proper formatting
 */
export const formatWeeklyScheduleMessage = (
  scheduleInfo: WeeklyScheduleInfo | null
): string => {
  if (!scheduleInfo || scheduleInfo.services.length === 0) {
    const { startDate, endDate } = scheduleInfo || {};
    if (startDate && endDate) {
      const startDateStr = formatDate(startDate);
      const endDateStr = formatDate(endDate);
      return `🌟 <b>Расписание служений</b> 🌟\n💥<b>Неделя с ${startDateStr} по ${endDateStr}</b> 💥\n\n📅 К сожалению, на эту неделю не запланировано служений для рассылки.\n\n🙌 Благословенной недели! 🙏\n#расписаниеслужений`;
    }
    return `🌟 <b>Расписание служений</b> 🌟\n💥<b>Неделя</b> 💥\n\n📅 К сожалению, на эту неделю не запланировано служений для рассылки.\n\n🙌 Благословенной недели! 🙏\n#расписаниеслужений`;
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

  // Generate all days of the week (Monday to Sunday)
  const allDaysOfWeek = getAllDaysOfWeek(startDate, endDate);

  // Format each day of the week
  for (const dayDate of allDaysOfWeek) {
    // Use local date format to match with service dates
    const dateStr = formatDateForNotion(dayDate);
    const dayName = getDayName(dayDate);
    const formattedDate = formatDate(dayDate);
    const dayServices = servicesByDate.get(dateStr) || [];

    // Show day if it has services, or if it's Monday (first day of week)
    // This ensures Monday is always shown even without services
    if (dayServices.length > 0 || dayDate.getDay() === 1) {
      message += `<b>${dayName}, ${formattedDate}</b>\n`;

      if (dayServices.length > 0) {
        for (const service of dayServices) {
          message += formatService(service);
        }
      }

      message += "\n";
    }
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
 * Group services by date (using local time to avoid timezone issues)
 */
const groupServicesByDate = (services: any[]): Map<string, any[]> => {
  const grouped = new Map<string, any[]>();

  for (const service of services) {
    // Use local date format to match with day dates
    const dateStr = formatDateForNotion(service.date);

    if (!grouped.has(dateStr)) {
      grouped.set(dateStr, []);
    }

    grouped.get(dateStr)!.push(service);
  }

  return grouped;
};

/**
 * Get all days of the week from Monday to Sunday
 */
const getAllDaysOfWeek = (startDate: Date, endDate: Date): Date[] => {
  const days: Date[] = [];
  const currentDate = new Date(startDate);
  
  // Ensure we start from the beginning of the day
  currentDate.setHours(0, 0, 0, 0);
  
  while (currentDate <= endDate) {
    days.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return days;
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
