import { SundayServiceInfo } from "../types";
import { formatServiceInfo } from "../services/calendarService";

/**
 * Format Sunday service information for Telegram message
 */
export const formatSundayServiceMessage = (
  serviceInfo: SundayServiceInfo | null
): string => {
  if (!serviceInfo) {
    return getNoDataMessage();
  }

  return formatServiceInfo(serviceInfo);
};

/**
 * Get message when no service data is available
 */
const getNoDataMessage = (): string => {
  return `📅 Информация о ближайшем воскресном служении пока недоступна.

Возможные причины:
• Служение еще не запланировано
• Данные еще не добавлены в календарь
• Проблемы с подключением к базе данных

Пожалуйста, обратитесь к администратору для получения актуальной информации.`;
};

/**
 * Format service type for display
 */
export const formatServiceType = (type: string): string => {
  switch (type) {
    case "Воскресное-1":
      return "I поток";
    case "Воскресное-2":
      return "II поток";
    default:
      return type;
  }
};

/**
 * Format boolean value for display
 */
export const formatBooleanValue = (value: boolean): string => {
  return value ? "есть" : "нет";
};

/**
 * Format number value for display
 */
export const formatNumberValue = (value: number | null): string => {
  return value !== null ? value.toString() : "не указано";
};

/**
 * Format text value for display
 */
export const formatTextValue = (value: string): string => {
  return value || "не указано";
};

/**
 * Format array of names for display
 */
export const formatNamesArray = (names: Array<{ name: string }>): string => {
  if (names.length === 0) {
    return "не указан";
  }
  return names.map((item) => item.name).join(", ");
};
