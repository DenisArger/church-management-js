import { Client } from "@notionhq/client";
import {
  WeeklyServiceItem,
  WeeklyScheduleInfo,
  NotionTitle,
  NotionDate,
  NotionSelect,
  NotionCheckbox,
  NotionRichText,
  CommandResult,
  ScheduleFormData,
} from "../../types";
import { getNotionClient } from "../notionService";
import { getNotionConfig } from "../../config/environment";
import { logInfo, logError } from "../../utils/logger";
import { formatDateForNotion } from "../../utils/dateHelper";

/**
 * Get weekly schedule with services that need mailing
 * Returns services for the specified week (current or next) with mailing flag enabled
 * @param weekType - "current" for current week, "next" for next week
 */
export const getWeeklySchedule = async (
  weekType: "current" | "next" = "next"
): Promise<WeeklyScheduleInfo | null> => {
  try {
    const client = getNotionClient();
    const config = getNotionConfig();
    const today = new Date();

    let weekStart: Date;
    let weekEnd: Date;

    if (weekType === "current") {
      // Calculate start and end of the current week (Monday to Sunday)
      const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      // Calculate days to Monday of current week
      // If Sunday (0), go back 6 days to get Monday
      // If Monday (1), no change (0 days)
      // For other days, go back (currentDay - 1) days
      const daysToMonday = currentDay === 0 ? -6 : currentDay === 1 ? 0 : -(currentDay - 1);

      weekStart = new Date(today);
      weekStart.setDate(today.getDate() + daysToMonday);
      weekStart.setHours(0, 0, 0, 0);

      weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
    } else {
      // Calculate start and end of the upcoming week (Monday to Sunday)
      // Get Monday of the next week (upcoming week)
      const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      // For Sunday, next Monday is tomorrow (+1 day)
      // For Monday, next Monday is in 7 days (+7 days)
      // For other days, calculate days until next Monday
      const daysUntilMonday = currentDay === 0 ? 1 : currentDay === 1 ? 7 : 8 - currentDay;

      weekStart = new Date(today);
      weekStart.setDate(today.getDate() + daysUntilMonday);
      weekStart.setHours(0, 0, 0, 0);

      weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
    }

    logInfo("Getting weekly schedule", {
      weekType,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
    });

    const services = await getWeeklyServices(
      client,
      config.generalCalendarDatabase,
      weekStart,
      weekEnd
    );

    if (services.length > 0) {
      logInfo("Found weekly services", {
        count: services.length,
        servicesWithMailing: services.filter((s) => s.needsMailing).length,
      });

      return {
        startDate: weekStart,
        endDate: weekEnd,
        services: services,
      };
    }

    logInfo("No weekly services found");
    return null;
  } catch (error) {
    logError("Error getting weekly schedule", error);
    return null;
  }
};

/**
 * Get services for a specific week with mailing filter
 */
const getWeeklyServices = async (
  client: Client,
  databaseId: string,
  startDate: Date,
  endDate: Date
): Promise<WeeklyServiceItem[]> => {
  try {
    const startDateStr = formatDateForNotion(startDate);
    const endDateStr = formatDateForNotion(endDate);

    logInfo("Querying Notion for weekly services", {
      databaseId,
      startDate: startDateStr,
      endDate: endDateStr,
    });

    const response = await client.databases.query({
      database_id: databaseId,
      filter: {
        and: [
          {
            property: "Дата",
            date: { on_or_after: startDateStr },
          },
          {
            property: "Дата",
            date: { on_or_before: endDateStr },
          },
          {
            property: "Нужна рассылка",
            checkbox: { equals: true },
          },
        ],
      },
    });

    logInfo("Notion query response for weekly services", {
      resultsCount: response.results.length,
    });

    // Map results to WeeklyServiceItem
    const services: WeeklyServiceItem[] = response.results.map(
      (page: unknown) => {
        return mapNotionPageToWeeklyService(page as Record<string, unknown>);
      }
    );

    // Sort services by date and time
    return services.sort((a, b) => {
      if (a.date.getTime() !== b.date.getTime()) {
        return a.date.getTime() - b.date.getTime();
      }
      // If same date, sort by time if available
      if (a.time && b.time) {
        return a.time.localeCompare(b.time);
      }
      return 0;
    });
  } catch (error) {
    logError("Error getting weekly services", error);
    return [];
  }
};

/**
 * Map Notion page to WeeklyServiceItem
 */
const mapNotionPageToWeeklyService = (
  page: Record<string, unknown>
): WeeklyServiceItem => {
  const properties = page.properties as Record<string, unknown>;

  // Try different possible field names for title
  const possibleTitleFields = [
    "Название служения",
    "Название",
    "Title",
    "Name",
    "Заголовок",
    "Service Title",
    "Event Title",
  ];
  let titleValue = "";

  for (const fieldName of possibleTitleFields) {
    const titleProp = properties[fieldName] as NotionTitle;
    if (
      titleProp?.title?.[0]?.text?.content &&
      titleProp.title[0].text.content.trim()
    ) {
      titleValue = titleProp.title[0].text.content.trim();
      break;
    } else if (
      titleProp?.title?.[0]?.plain_text &&
      titleProp.title[0].plain_text.trim()
    ) {
      titleValue = titleProp.title[0].plain_text.trim();
      break;
    }
  }

  // If no title found, try fallback fields
  if (!titleValue) {
    const fallbackFields = [
      "Примечание",
      "Описание",
      "Description",
      "Note",
      "Комментарий",
      "Comment",
    ];

    for (const fieldName of fallbackFields) {
      const fallbackProp = properties[fieldName] as NotionRichText;
      if (
        fallbackProp?.rich_text?.[0]?.text?.content &&
        fallbackProp.rich_text[0].text.content.trim()
      ) {
        titleValue = fallbackProp.rich_text[0].text.content.trim();
        break;
      }
    }
  }

  const dateProp = properties["Дата"] as NotionDate;
  const typeProp = properties["Тип служения"] as NotionSelect;
  const mailingProp = properties["Нужна рассылка"] as NotionCheckbox;

  // Extract time from date field if it contains time
  let timeFromDate = undefined;
  if (dateProp?.date?.start?.includes("T")) {
    const dateTime = new Date(dateProp.date.start);
    timeFromDate = dateTime.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    });
  }

  // Try different possible field names for time
  const possibleTimeFields = [
    "Время",
    "Time",
    "Время начала",
    "Start Time",
    "Время служения",
    "Service Time",
    "Час",
    "Hour",
  ];
  let timeValue = undefined;

  for (const fieldName of possibleTimeFields) {
    const timeProp = properties[fieldName] as NotionRichText;
    if (
      timeProp?.rich_text?.[0]?.text?.content &&
      timeProp.rich_text[0].text.content.trim()
    ) {
      timeValue = timeProp.rich_text[0].text.content.trim();
      break;
    }
  }

  // Try different possible field names for description
  const possibleDescriptionFields = [
    "Описание",
    "Description",
    "Примечание",
    "Note",
    "Комментарий",
    "Comment",
    "Детали",
    "Details",
    "Информация о служении",
    "Service Info",
    "Тема",
    "Topic",
    "Содержание",
    "Content",
  ];
  let descriptionValue = undefined;

  for (const fieldName of possibleDescriptionFields) {
    const descriptionProp = properties[fieldName] as NotionRichText;
    if (
      descriptionProp?.rich_text?.[0]?.text?.content &&
      descriptionProp.rich_text[0].text.content.trim()
    ) {
      descriptionValue = descriptionProp.rich_text[0].text.content.trim();
      break;
    }
  }

  // Try different possible field names for location
  const possibleLocationFields = [
    "Место",
    "Место проведения",
    "Location",
    "Place",
    "Адрес",
    "Address",
    "Где",
    "Where",
    "Место проведения служения",
    "Service Location",
    "Зал",
    "Hall",
    "Помещение",
    "Room",
  ];
  let locationValue = undefined;

  for (const fieldName of possibleLocationFields) {
    const locationProp = properties[fieldName] as any;

    // Check if it's a rich text field
    if (
      locationProp?.type === "rich_text" &&
      locationProp?.rich_text?.[0]?.text?.content &&
      locationProp.rich_text[0].text.content.trim()
    ) {
      locationValue = locationProp.rich_text[0].text.content.trim();
      break;
    }

    // Check if it's a select field
    if (locationProp?.type === "select" && locationProp?.select?.name) {
      locationValue = locationProp.select.name;
      break;
    }

    // Check if it's a multi_select field
    if (
      locationProp?.type === "multi_select" &&
      locationProp?.multi_select &&
      locationProp.multi_select.length > 0
    ) {
      locationValue = locationProp.multi_select
        .map((item: any) => item.name)
        .join(", ");
      break;
    }
  }

  return {
    id: page.id as string,
    title: titleValue || "Служение",
    date: new Date(
      (dateProp?.date?.start as string) || (page.created_time as string)
    ),
    time: timeValue || timeFromDate,
    type: typeProp?.select?.name || "",
    description: descriptionValue,
    location: locationValue,
    needsMailing: mailingProp?.checkbox || false,
  };
};

/**
 * Get schedule service by ID
 */
export const getScheduleServiceById = async (
  serviceId: string
): Promise<WeeklyServiceItem | null> => {
  try {
    const client = getNotionClient();

    logInfo("Getting schedule service by ID", { serviceId });

    const page = await client.pages.retrieve({
      page_id: serviceId,
    });

    const service = mapNotionPageToWeeklyService(page as Record<string, unknown>);

    logInfo("Schedule service found", {
      serviceId,
      title: service.title,
      date: formatDateForNotion(service.date),
    });

    return service;
  } catch (error) {
    logError("Error getting schedule service by ID", error);
    return null;
  }
};

/**
 * Get schedule services for week (without mailing filter)
 * Used for selecting services to edit
 */
export const getScheduleServicesForWeek = async (
  weekType: "current" | "next" = "next"
): Promise<WeeklyServiceItem[]> => {
  try {
    const client = getNotionClient();
    const config = getNotionConfig();
    const today = new Date();

    let weekStart: Date;
    let weekEnd: Date;

    if (weekType === "current") {
      // Calculate start and end of the current week (Monday to Sunday)
      const currentDay = today.getDay();
      const daysToMonday = currentDay === 0 ? -6 : currentDay === 1 ? 0 : -(currentDay - 1);

      weekStart = new Date(today);
      weekStart.setDate(today.getDate() + daysToMonday);
      weekStart.setHours(0, 0, 0, 0);

      weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
    } else {
      // Calculate start and end of the upcoming week (Monday to Sunday)
      const currentDay = today.getDay();
      const daysUntilMonday = currentDay === 0 ? 1 : currentDay === 1 ? 7 : 8 - currentDay;

      weekStart = new Date(today);
      weekStart.setDate(today.getDate() + daysUntilMonday);
      weekStart.setHours(0, 0, 0, 0);

      weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
    }

    logInfo("Getting schedule services for week", {
      weekType,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
    });

    const startDateStr = formatDateForNotion(weekStart);
    const endDateStr = formatDateForNotion(weekEnd);

    const response = await client.databases.query({
      database_id: config.generalCalendarDatabase,
      filter: {
        and: [
          {
            property: "Дата",
            date: { on_or_after: startDateStr },
          },
          {
            property: "Дата",
            date: { on_or_before: endDateStr },
          },
        ],
      },
    });

    logInfo("Notion query response for schedule services", {
      resultsCount: response.results.length,
    });

    // Map results to WeeklyServiceItem
    const services: WeeklyServiceItem[] = response.results.map(
      (page: unknown) => {
        return mapNotionPageToWeeklyService(page as Record<string, unknown>);
      }
    );

    // Sort services by date and time
    return services.sort((a, b) => {
      if (a.date.getTime() !== b.date.getTime()) {
        return a.date.getTime() - b.date.getTime();
      }
      if (a.time && b.time) {
        return a.time.localeCompare(b.time);
      }
      return 0;
    });
  } catch (error) {
    logError("Error getting schedule services for week", error);
    return [];
  }
};

/**
 * Create schedule service in Notion
 */
export const createScheduleService = async (
  serviceData: ScheduleFormData
): Promise<CommandResult> => {
  try {
    const client = getNotionClient();
    const config = getNotionConfig();

    if (!serviceData.date || !serviceData.title) {
      return {
        success: false,
        error: "Недостаточно данных для создания служения",
      };
    }

    // Format date for Notion
    const baseDate = serviceData.date instanceof Date
      ? new Date(serviceData.date)
      : new Date(serviceData.date);

    // Set time to start of day
    const serviceDate = new Date(baseDate);
    serviceDate.setHours(0, 0, 0, 0);

    const dateStr = formatDateForNotion(serviceDate);

    logInfo("Creating schedule service", {
      dateStr,
      title: serviceData.title,
    });

    // Prepare properties
    const properties: Record<string, unknown> = {
      "Название служения": {
        title: [{ text: { content: serviceData.title } }],
      },
      Дата: {
        date: { start: dateStr },
      },
      "Нужна рассылка": {
        checkbox: false, // Default to false, can be changed later
      },
    };

    const response = await client.pages.create({
      parent: { database_id: config.generalCalendarDatabase },
      properties: properties as any,
    });

    logInfo("Schedule service created", {
      pageId: response.id,
      date: dateStr,
      title: serviceData.title,
    });

    return {
      success: true,
      message: "Служение успешно создано",
      data: { pageId: response.id },
    };
  } catch (error) {
    logError("Error creating schedule service", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Неизвестная ошибка при создании служения",
    };
  }
};

/**
 * Update schedule service in Notion
 */
export const updateScheduleService = async (
  serviceId: string,
  serviceData: ScheduleFormData
): Promise<CommandResult> => {
  try {
    const client = getNotionClient();

    // Prepare properties to update
    const properties: Record<string, unknown> = {};

    if (serviceData.title) {
      properties["Название служения"] = {
        title: [{ text: { content: serviceData.title } }],
      };
    }

    if (serviceData.date) {
      const dateToFormat = serviceData.date instanceof Date
        ? serviceData.date
        : new Date(serviceData.date);
      const dateStr = formatDateForNotion(dateToFormat);
      properties["Дата"] = {
        date: { start: dateStr },
      };
    }

    await client.pages.update({
      page_id: serviceId,
      properties: properties as any,
    });

    logInfo("Schedule service updated", {
      pageId: serviceId,
    });

    return {
      success: true,
      message: "Служение успешно обновлено",
    };
  } catch (error) {
    logError("Error updating schedule service", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Неизвестная ошибка при обновлении служения",
    };
  }
};
