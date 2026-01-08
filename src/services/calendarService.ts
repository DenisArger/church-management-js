import { Client } from "@notionhq/client";
import {
  SundayServiceItem,
  SundayServiceInfo,
  WeeklyServiceItem,
  WeeklyScheduleInfo,
  NotionTitle,
  NotionDate,
  NotionSelect,
  NotionMultiSelect,
  NotionCheckbox,
  NotionNumber,
  NotionRichText,
  NotionMultiSelectOption,
  CommandResult,
  SundayServiceFormData,
} from "../types";
import { getNotionClient } from "./notionService";
import { getNotionConfig } from "../config/environment";
import { logInfo, logError, logWarn } from "../utils/logger";
import { formatDateForNotion } from "../utils/dateHelper";

// Constants for service types
export const ITEM_TYPE_SUNDAY_1 = "Воскресное-1"; // I поток
export const ITEM_TYPE_SUNDAY_2 = "Воскресное-2"; // II поток

/**
 * Debug function to check all records in the calendar database
 */
export const debugCalendarDatabase = async (): Promise<void> => {
  try {
    const client = getNotionClient();
    const config = getNotionConfig();

    logInfo("Querying all calendar records");

    const response = await client.databases.query({
      database_id: config.generalCalendarDatabase,
      page_size: 10, // Limit to first 10 records
    });

    logInfo("Calendar database records", {
      totalResults: response.results.length,
      hasMore: response.has_more,
    });

    response.results.forEach((page: unknown, index: number) => {
      const pageData = page as Record<string, unknown>;
      const properties = pageData.properties as Record<string, unknown>;

      const titleProp = properties["Название служения"] as NotionTitle;
      const dateProp = properties["Дата"] as NotionDate;
      const typeProp = properties["Тип служения"] as NotionSelect;

      logInfo(`Record ${index + 1}`, {
        id: pageData.id,
        title: titleProp?.title?.[0]?.text?.content || "No title",
        date: dateProp?.date?.start || "No date",
        type: typeProp?.select?.name || "No type",
        allProperties: Object.keys(properties),
      });
    });
  } catch (error) {
    logError("Error querying calendar database", error);
  }
};

/**
 * Get Sunday meeting information from Notion calendar
 * Searches for the next Sunday and returns service information
 */
export const getSundayMeeting = async (): Promise<SundayServiceInfo | null> => {
  try {
    const client = getNotionClient();
    const config = getNotionConfig();
    const today = new Date();

    // Calculate days until next Sunday
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    let daysUntilSunday;

    if (currentDay === 0) {
      // If today is Sunday, look for next Sunday (7 days later)
      daysUntilSunday = 7;
    } else {
      // Calculate days until next Sunday
      daysUntilSunday = 7 - currentDay;
    }

    const targetSunday = new Date(today);
    targetSunday.setDate(today.getDate() + daysUntilSunday);
    // Set time to start of day to avoid timezone issues
    targetSunday.setHours(0, 0, 0, 0);

    const services = await getServicesForDate(
      client,
      config.generalCalendarDatabase,
      targetSunday
    );

    if (services.length > 0) {
      logInfo("Found Sunday services", {
        date: targetSunday.toISOString(),
        count: services.length,
      });

      return {
        date: targetSunday,
        services: services,
      };
    }

    logInfo("No Sunday services found for next Sunday");
    return null;
  } catch (error) {
    logError("Error getting Sunday meeting", error);
    return null;
  }
};

/**
 * Get services for a specific date
 */
const getServicesForDate = async (
  client: Client,
  databaseId: string,
  targetDate: Date
): Promise<SundayServiceItem[]> => {
  try {
    const dateStr = formatDateForNotion(targetDate);
    
    // Create date range for the target date (start and end of day in UTC)
    // This helps avoid timezone issues when searching
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Format dates for Notion API (YYYY-MM-DD format)
    const startDateStr = formatDateForNotion(startOfDay);
    const endDateStr = formatDateForNotion(endOfDay);

    logInfo("Searching for services by date", {
      targetDate: dateStr,
      dateISO: targetDate.toISOString(),
      startDateStr,
      endDateStr,
      localDate: {
        year: targetDate.getFullYear(),
        month: targetDate.getMonth() + 1,
        day: targetDate.getDate(),
      },
    });

    // Try exact date match first
    let response = await client.databases.query({
      database_id: databaseId,
      filter: {
        and: [
          {
            property: "Дата",
            date: { equals: dateStr },
          },
          {
            or: [
              {
                property: "Тип служения",
                select: { equals: ITEM_TYPE_SUNDAY_1 },
              },
              {
                property: "Тип служения",
                select: { equals: ITEM_TYPE_SUNDAY_2 },
              },
            ],
          },
        ],
      },
    });

    logInfo("Exact date match query result", {
      dateStr,
      resultsCount: response.results.length,
      resultIds: response.results.map((r: any) => r.id),
    });

    // If no exact match, try date range search (to handle timezone differences)
    if (response.results.length === 0) {
      logInfo("Trying date range search", {
        startDateStr,
        endDateStr,
      });
      
      response = await client.databases.query({
        database_id: databaseId,
        filter: {
          and: [
            {
              property: "Дата",
              date: {
                on_or_after: startDateStr,
                on_or_before: endDateStr,
              },
            },
            {
              or: [
                {
                  property: "Тип служения",
                  select: { equals: ITEM_TYPE_SUNDAY_1 },
                },
                {
                  property: "Тип служения",
                  select: { equals: ITEM_TYPE_SUNDAY_2 },
                },
              ],
            },
          ],
        },
      });
      
      logInfo("Date range search result", {
        resultsCount: response.results.length,
        resultIds: response.results.map((r: any) => r.id),
      });
    }

    // Remove duplicates and map to SundayServiceItem
    const uniqueResults = new Map();
    response.results.forEach((page: unknown) => {
      const pageData = page as Record<string, unknown>;
      const serviceId = pageData.id as string;
      if (!uniqueResults.has(serviceId)) {
        uniqueResults.set(serviceId, pageData);
      }
    });

    const services: SundayServiceItem[] = Array.from(
      uniqueResults.values()
    ).map((page: unknown) => {
      const mapped = mapNotionPageToSundayService(page as Record<string, unknown>);
      // Log each mapped service for debugging
      logInfo("Mapped service from Notion", {
        id: mapped.id,
        type: mapped.type,
        date: formatDateForNotion(mapped.date),
        dateISO: mapped.date.toISOString(),
        rawDateFromNotion: (page as any).properties?.["Дата"]?.date?.start,
      });
      return mapped;
    });

    // Sort services by type (I поток first, then II поток) and limit to 2 services max
    return services
      .sort((a, b) => {
        if (a.type === ITEM_TYPE_SUNDAY_1 && b.type === ITEM_TYPE_SUNDAY_2)
          return -1;
        if (a.type === ITEM_TYPE_SUNDAY_2 && b.type === ITEM_TYPE_SUNDAY_1)
          return 1;
        return 0;
      })
      .slice(0, 2); // Limit to maximum 2 services (I поток and II поток)
  } catch (error) {
    logError("Error getting services for date", error);
    return [];
  }
};

/**
 * Validate Sunday service data and log warnings for missing fields
 */
const validateSundayServiceData = (
  page: Record<string, unknown>,
  properties: Record<string, unknown>
): void => {
  const warnings: string[] = [];

  // Check for missing title
  const titleProp = properties["Название служения"] as NotionTitle;
  if (
    !titleProp?.title?.[0]?.text?.content ||
    !titleProp.title[0].text.content.trim()
  ) {
    warnings.push("Отсутствует название служения");
  }

  // Check for missing date
  const dateProp = properties["Дата"] as NotionDate;
  if (!dateProp?.date?.start) {
    warnings.push("Отсутствует дата служения");
  }

  // Check for missing service type
  const typeProp = properties["Тип служения"] as NotionSelect;
  if (!typeProp?.select?.name) {
    warnings.push("Отсутствует тип служения");
  }

  // Check for missing preachers
  const preachersProp = properties["Проповедники"] as NotionMultiSelect;
  if (!preachersProp?.multi_select || preachersProp.multi_select.length === 0) {
    warnings.push("Не указаны проповедники");
  }

  // Check for missing worship service
  const worshipServiceProp = properties["Музыкальное служение"] as NotionSelect;
  if (!worshipServiceProp?.select?.name) {
    warnings.push("Не указано музыкальное служение");
  }

  // Log warnings if any
  if (warnings.length > 0) {
    logWarn(`Validation warnings for service ${page.id}`, {
      warnings,
      availableProperties: Object.keys(properties),
    });
  }
};

/**
 * Map Notion page to SundayServiceItem
 */
const mapNotionPageToSundayService = (
  page: Record<string, unknown>
): SundayServiceItem => {
  const properties = page.properties as Record<string, unknown>;

  // Validate the data and log warnings
  validateSundayServiceData(page, properties);

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

  // If no title found in any field, try to use other fields as fallback
  if (!titleValue) {
    // Try to use other text fields as fallback
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

    // If still no title, generate one based on date and type
    if (!titleValue) {
      const dateProp = properties["Дата"] as NotionDate;
      const typeProp = properties["Тип служения"] as NotionSelect;

      if (dateProp?.date?.start && typeProp?.select?.name) {
        const serviceDate = new Date(dateProp.date.start);
        const streamName =
          typeProp.select.name === "Воскресное-1" ? "I поток" : "II поток";
              titleValue = `Воскресное служение ${streamName} - ${serviceDate.toLocaleDateString(
                "ru-RU"
              )}`;
            } else {
              // Fallback if even date/type are missing
              titleValue = "Воскресное служение";
            }
    }
  }
  const dateProp = properties["Дата"] as NotionDate;
  const typeProp = properties["Тип служения"] as NotionSelect;
  const preachersProp = properties["Проповедники"] as NotionMultiSelect;
  const worshipServiceProp = properties["Музыкальное служение"] as NotionSelect;
  // Try different possible field names for "Песня перед началом"
  // Order matters: try more specific names first
  const possibleSongBeforeStartFields = [
    "Песня перед началом(1)",
    "Песня перед началом",
    "Песня перед началом служения",
    "Песня в начале",
    "Song before start",
    "Песня в начале служения",
  ];
  let songBeforeStartValue = false;
  let songBeforeStartFieldName = "";

  for (const fieldName of possibleSongBeforeStartFields) {
    const prop = properties[fieldName] as NotionCheckbox | any;
    // Check if property exists and has checkbox field
    if (prop !== undefined && prop !== null && prop.checkbox !== undefined) {
      songBeforeStartValue = prop.checkbox === true;
      songBeforeStartFieldName = fieldName;
      break;
    }
  }

  const numWorshipSongsProp = properties[
    "Количество песен на прославлении"
  ] as NotionNumber;

  // Try different possible field names for "Песня группы" (formerly "Сольная песня")
  // Order matters: try more specific names first
  const possibleSoloSongFields = [
    "Песня группы",
    "Сольная песня группы",
    "Сольная песня",
    "Сольная",
    "Solo song",
    "Сольное пение",
    "Сольный номер",
  ];
  let soloSongValue = false;
  let soloSongFieldName = "";

  for (const fieldName of possibleSoloSongFields) {
    const prop = properties[fieldName] as NotionCheckbox | any;
    // Check if property exists and has checkbox field
    if (prop !== undefined && prop !== null && prop.checkbox !== undefined) {
      soloSongValue = prop.checkbox === true;
      soloSongFieldName = fieldName;
      break;
    }
  }

  const repentanceSongProp = properties["Песня на покаяние"] as NotionCheckbox;
  const scriptureReadingProp = properties["Чтение Писания"] as NotionRichText;
  const scriptureReaderProp = properties["Чтец Писания"] as NotionSelect;

  return {
    id: page.id as string,
    title: titleValue,
    date: new Date(
      (dateProp?.date?.start as string) || (page.created_time as string)
    ),
    type: typeProp?.select?.name || "",
    preachers: (preachersProp?.multi_select as NotionMultiSelectOption[]) || [],
    worshipService: worshipServiceProp?.select?.name || "",
    songBeforeStart: songBeforeStartValue,
    numWorshipSongs: (numWorshipSongsProp?.number as number | null) || null,
    soloSong: soloSongValue,
    repentanceSong: repentanceSongProp?.checkbox || false,
    scriptureReading: scriptureReadingProp?.rich_text?.[0]?.text?.content || "",
    scriptureReader: scriptureReaderProp?.select?.name || "",
  };
};

/**
 * Format service information for display
 */
export const formatServiceInfo = (serviceInfo: SundayServiceInfo): string => {
  const { date, services } = serviceInfo;
  const dateStr = date.toLocaleDateString("ru-RU");

  // Header: bold and underlined
  let message = `<b><u>Информация по воскресным служениям (${dateStr})</u></b>\n\n`;

  services.forEach((service) => {
    const streamName =
      service.type === ITEM_TYPE_SUNDAY_1 ? "I поток" : "II поток";
    // Stream name: underlined
    message += `<u>${streamName}</u>\n`;

    // Preachers - label bold
    const preachers =
      service.preachers.length > 0
        ? service.preachers.map((p) => p.name).join(", ")
        : "не указан";
    message += `- <b>Проповедник:</b> ${preachers}\n`;

    // Worship service - label bold
    const worshipService = service.worshipService || "не указано";
    message += `- <b>Прославление:</b> ${worshipService}\n`;

    // Song before start - label bold
    const songBeforeStart = service.songBeforeStart ? "есть" : "нет";
    message += `  - <b>Песня перед началом:</b> ${songBeforeStart}\n`;

    // Number of worship songs - label bold
    const numSongs =
      service.numWorshipSongs !== null
        ? service.numWorshipSongs.toString()
        : "не указано";
    message += `  - <b>Количество песен на прославлении:</b> ${numSongs}\n`;

    // Solo song (Песня группы) - label bold
    const soloSong = service.soloSong ? "есть" : "нет";
    message += `  - <b>Песня группы:</b> ${soloSong}\n`;

    // Repentance song - label bold
    const repentanceSong = service.repentanceSong ? "есть" : "нет";
    message += `  - <b>Песня на покаяние:</b> ${repentanceSong}\n`;

    // Scripture reading - label bold
    const scriptureReading = service.scriptureReading || "не указано";
    message += `- <b>Чтение Писания:</b> ${scriptureReading}\n`;

    // Scripture reader - label bold
    const scriptureReader = service.scriptureReader || "Нужна помощь";
    message += `- <b>Чтец Писания:</b> ${scriptureReader}\n\n`;
  });

  // Check message length and truncate if necessary
  const maxLength = 4000; // Telegram message limit
  if (message.length > maxLength) {
    message =
      message.substring(0, maxLength - 50) + "...\n\n📝 Сообщение сокращено";
  }

  return message.trim();
};

/**
 * Get weekly schedule with services that need mailing
 * Returns services for the upcoming week with mailing flag enabled
 */
export const getWeeklySchedule =
  async (): Promise<WeeklyScheduleInfo | null> => {
    try {
      const client = getNotionClient();
      const config = getNotionConfig();
      const today = new Date();

      // Calculate start and end of the week (Monday to Sunday)
      const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const daysUntilMonday =
        currentDay === 0 ? 1 : currentDay === 1 ? 0 : 8 - currentDay;

      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + daysUntilMonday);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      logInfo("Getting weekly schedule", {
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
 * Create Sunday service in Notion
 */
export const createSundayService = async (
  serviceData: SundayServiceFormData,
  streamType: "1" | "2"
): Promise<CommandResult> => {
  try {
    const client = getNotionClient();
    const config = getNotionConfig();

    const streamData =
      serviceData.stream === "both"
        ? streamType === "1"
          ? serviceData.stream1Data
          : serviceData.stream2Data
        : serviceData;

    if (!streamData || !serviceData.date) {
      return {
        success: false,
        error: "Недостаточно данных для создания служения",
      };
    }

    const serviceType =
      streamType === "1" ? ITEM_TYPE_SUNDAY_1 : ITEM_TYPE_SUNDAY_2;

    // Format date for Notion in local time to avoid timezone issues
    // If serviceData.date is already a Date, use it directly; otherwise create new Date
    const baseDate = serviceData.date instanceof Date 
      ? new Date(serviceData.date)
      : new Date(serviceData.date);
    
    // Set time based on stream type: 1 поток = 10:00, 2 поток = 13:00
    const serviceDate = new Date(baseDate);
    if (streamType === "1") {
      serviceDate.setHours(10, 0, 0, 0);
    } else {
      serviceDate.setHours(13, 0, 0, 0);
    }
    
    // Format date with time for Notion API (ISO 8601 format with timezone)
    // Notion expects format like "2026-01-18T10:00:00.000+03:00" (with timezone offset)
    const year = serviceDate.getFullYear();
    const month = String(serviceDate.getMonth() + 1).padStart(2, "0");
    const day = String(serviceDate.getDate()).padStart(2, "0");
    const hours = String(serviceDate.getHours()).padStart(2, "0");
    const minutes = String(serviceDate.getMinutes()).padStart(2, "0");
    const seconds = String(serviceDate.getSeconds()).padStart(2, "0");
    
    // Get timezone offset in format +03:00
    const timezoneOffset = -serviceDate.getTimezoneOffset();
    const offsetHours = String(Math.floor(Math.abs(timezoneOffset) / 60)).padStart(2, "0");
    const offsetMinutes = String(Math.abs(timezoneOffset) % 60).padStart(2, "0");
    const offsetSign = timezoneOffset >= 0 ? "+" : "-";
    const timezoneStr = `${offsetSign}${offsetHours}:${offsetMinutes}`;
    
    const dateWithTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000${timezoneStr}`;
    const dateStr = formatDateForNotion(baseDate); // Keep simple format for logging

    logInfo("Creating Sunday service with date and time", {
      dateStr,
      dateWithTime,
      dateISO: serviceDate.toISOString(),
      localDate: {
        year: serviceDate.getFullYear(),
        month: serviceDate.getMonth() + 1,
        day: serviceDate.getDate(),
        hours: serviceDate.getHours(),
        minutes: serviceDate.getMinutes(),
      },
      streamType,
      serviceType,
    });

    // Generate title if not provided
    let serviceTitle = streamData.title;
    if (!serviceTitle || serviceTitle.trim() === "") {
      const dateStr = new Date(serviceData.date).toLocaleDateString("ru-RU");
      const streamName = streamType === "1" ? "I поток" : "II поток";
      serviceTitle = `Воскресное служение ${streamName} - ${dateStr}`;
    }

    // Prepare properties
    const properties: Record<string, unknown> = {
      "Название служения": {
        title: [{ text: { content: serviceTitle } }],
      },
      Дата: {
        date: { start: dateWithTime },
      },
      "Тип служения": {
        select: { name: serviceType },
      },
    };

    // Add preachers (multi-select)
    if (streamData.preachers && streamData.preachers.length > 0) {
      properties["Проповедники"] = {
        multi_select: streamData.preachers.map((name) => ({ name })),
      };
    }

    // Add worship service
    if (streamData.worshipService) {
      properties["Музыкальное служение"] = {
        select: { name: streamData.worshipService },
      };
    }

    // Add song before start
    if (streamData.songBeforeStart !== undefined) {
      // Use "Песня перед началом" as the standard field name
      properties["Песня перед началом"] = {
        checkbox: streamData.songBeforeStart,
      };
    }

    // Add number of worship songs
    if (streamData.numWorshipSongs !== null && streamData.numWorshipSongs !== undefined) {
      properties["Количество песен на прославлении"] = {
        number: streamData.numWorshipSongs,
      };
    }

    // Add solo song
    if (streamData.soloSong !== undefined) {
      properties["Песня группы"] = {
        checkbox: streamData.soloSong,
      };
    }

    // Add repentance song
    if (streamData.repentanceSong !== undefined) {
      properties["Песня на покаяние"] = {
        checkbox: streamData.repentanceSong,
      };
    }

    // Add scripture reading
    if (streamData.scriptureReading) {
      properties["Чтение Писания"] = {
        rich_text: [{ text: { content: streamData.scriptureReading } }],
      };
    }

    // Add scripture reader
    if (streamData.scriptureReader) {
      properties["Чтец Писания"] = {
        select: { name: streamData.scriptureReader },
      };
    }

    const response = await client.pages.create({
      parent: { database_id: config.generalCalendarDatabase },
      properties: properties as any,
    });

    logInfo("Sunday service created", {
      pageId: response.id,
      streamType,
      date: dateStr,
    });

    return {
      success: true,
      message: "Воскресное служение успешно создано",
      data: { pageId: response.id },
    };
  } catch (error) {
    logError("Error creating Sunday service", error);
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
 * Update Sunday service in Notion
 */
export const updateSundayService = async (
  serviceId: string,
  serviceData: SundayServiceFormData,
  streamType?: "1" | "2"
): Promise<CommandResult> => {
  try {
    const client = getNotionClient();

    const streamData =
      serviceData.stream === "both" && streamType
        ? streamType === "1"
          ? serviceData.stream1Data
          : serviceData.stream2Data
        : serviceData;

    if (!streamData) {
      return {
        success: false,
        error: "Недостаточно данных для обновления служения",
      };
    }

    // Prepare properties to update
    const properties: Record<string, unknown> = {};

    if (streamData.title) {
      properties["Название служения"] = {
        title: [{ text: { content: streamData.title } }],
      };
    }

    if (serviceData.date) {
      // If serviceData.date is already a Date, use it directly; otherwise create new Date
      const dateToFormat = serviceData.date instanceof Date 
        ? serviceData.date 
        : new Date(serviceData.date);
      const dateStr = formatDateForNotion(dateToFormat);
      properties["Дата"] = {
        date: { start: dateStr },
      };
    }

    if (streamData.preachers && streamData.preachers.length > 0) {
      properties["Проповедники"] = {
        multi_select: streamData.preachers.map((name) => ({ name })),
      };
    }

    if (streamData.worshipService) {
      properties["Музыкальное служение"] = {
        select: { name: streamData.worshipService },
      };
    }

    if (streamData.songBeforeStart !== undefined) {
      // Use only the field that exists in the database
      // Try "Песня перед началом" first, as it's more common
      properties["Песня перед началом"] = {
        checkbox: streamData.songBeforeStart,
      };
    }

    if (streamData.numWorshipSongs !== null && streamData.numWorshipSongs !== undefined) {
      properties["Количество песен на прославлении"] = {
        number: streamData.numWorshipSongs,
      };
    }

    if (streamData.soloSong !== undefined) {
      properties["Песня группы"] = {
        checkbox: streamData.soloSong,
      };
    }

    if (streamData.repentanceSong !== undefined) {
      properties["Песня на покаяние"] = {
        checkbox: streamData.repentanceSong,
      };
    }

    if (streamData.scriptureReading !== undefined) {
      properties["Чтение Писания"] = {
        rich_text: streamData.scriptureReading
          ? [{ text: { content: streamData.scriptureReading } }]
          : [],
      };
    }

    // Always update scripture reader field if it's specified in updateData
    // If it's undefined, we don't update it (to preserve existing value)
    // If it's empty string or null, we clear it
    if (streamData.scriptureReader !== undefined) {
      if (streamData.scriptureReader) {
        properties["Чтец Писания"] = {
          select: { name: streamData.scriptureReader },
        };
      } else {
        // Clear the field if empty string or null
        properties["Чтец Писания"] = {
          select: null,
        };
      }
    }

    await client.pages.update({
      page_id: serviceId,
      properties: properties as any,
    });

    logInfo("Sunday service updated", {
      pageId: serviceId,
      streamType,
    });

    return {
      success: true,
      message: "Воскресное служение успешно обновлено",
    };
  } catch (error) {
    logError("Error updating Sunday service", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Неизвестная ошибка при обновлении служения",
    };
  }
};

/**
 * Get Sunday service by date and stream type
 */
export const getSundayServiceByDate = async (
  date: Date,
  streamType: "1" | "2"
): Promise<SundayServiceItem | null> => {
  try {
    const client = getNotionClient();
    const config = getNotionConfig();

    const serviceType =
      streamType === "1" ? ITEM_TYPE_SUNDAY_1 : ITEM_TYPE_SUNDAY_2;
    const dateStr = formatDateForNotion(date);

    logInfo("Getting Sunday service by date", {
      dateStr,
      dateISO: date.toISOString(),
      streamType,
      serviceType,
      localDate: {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
      },
    });

    const services = await getServicesForDate(
      client,
      config.generalCalendarDatabase,
      date
    );

    logInfo("Services found for date", {
      dateStr,
      servicesCount: services.length,
      services: services.map((s) => ({
        id: s.id,
        type: s.type,
        date: formatDateForNotion(s.date),
        dateISO: s.date.toISOString(),
      })),
    });

    const service = services.find((s) => s.type === serviceType);

    if (service) {
      logInfo("Sunday service found", {
        serviceId: service.id,
        date: dateStr,
        streamType,
        serviceDate: formatDateForNotion(service.date),
        serviceDateISO: service.date.toISOString(),
      });
      return service;
    }

    logInfo("Sunday service not found", {
      date: dateStr,
      streamType,
      serviceType,
      availableServices: services.map((s) => s.type),
    });
    return null;
  } catch (error) {
    logError("Error getting Sunday service by date", error);
    return null;
  }
};

/**
 * Get available worship services from Notion database
 * Extracts unique values from existing records and schema options
 */
export const getWorshipServices = async (): Promise<string[]> => {
  try {
    const client = getNotionClient();
    const config = getNotionConfig();

    // First, try to get options from database schema
    try {
      const database = await client.databases.retrieve({
        database_id: config.generalCalendarDatabase,
      });

      const worshipServiceProperty = database.properties[
        "Музыкальное служение"
      ] as any;

      if (
        worshipServiceProperty &&
        worshipServiceProperty.type === "select" &&
        worshipServiceProperty.select?.options
      ) {
        const options = worshipServiceProperty.select.options.map(
          (opt: any) => opt.name
        );
        logInfo("Retrieved worship services from schema", {
          count: options.length,
        });
        return options;
      }
    } catch (schemaError) {
      logWarn("Could not get worship services from schema", schemaError);
    }

    // Fallback: get unique values from existing records
    const response = await client.databases.query({
      database_id: config.generalCalendarDatabase,
      page_size: 100,
    });

    const worshipServicesSet = new Set<string>();

    response.results.forEach((page: any) => {
      const worshipServiceProp = page.properties[
        "Музыкальное служение"
      ] as NotionSelect;
      if (worshipServiceProp?.select?.name) {
        worshipServicesSet.add(worshipServiceProp.select.name);
      }
    });

    const worshipServices = Array.from(worshipServicesSet).sort();
    logInfo("Retrieved worship services from records", {
      count: worshipServices.length,
    });

    return worshipServices;
  } catch (error) {
    logError("Error getting worship services", error);
    // Return empty array on error
    return [];
  }
};

/**
 * Get available scripture readers from Notion database
 * Extracts unique values from existing records and schema options
 */
export const getScriptureReaders = async (): Promise<string[]> => {
  try {
    const client = getNotionClient();
    const config = getNotionConfig();

    // First, try to get options from database schema
    try {
      const database = await client.databases.retrieve({
        database_id: config.generalCalendarDatabase,
      });

      const scriptureReaderProperty = database.properties[
        "Чтец Писания"
      ] as any;

      if (
        scriptureReaderProperty &&
        scriptureReaderProperty.type === "select" &&
        scriptureReaderProperty.select?.options
      ) {
        const options = scriptureReaderProperty.select.options.map(
          (opt: any) => opt.name
        );
        logInfo("Retrieved scripture readers from schema", {
          count: options.length,
        });
        return options;
      }
    } catch (schemaError) {
      logWarn("Could not get scripture readers from schema", schemaError);
    }

    // Fallback: get unique values from existing records
    const response = await client.databases.query({
      database_id: config.generalCalendarDatabase,
      page_size: 100,
    });

    const scriptureReadersSet = new Set<string>();

    response.results.forEach((page: any) => {
      const scriptureReaderProp = page.properties[
        "Чтец Писания"
      ] as NotionSelect;
      if (scriptureReaderProp?.select?.name) {
        scriptureReadersSet.add(scriptureReaderProp.select.name);
      }
    });

    const scriptureReaders = Array.from(scriptureReadersSet).sort();
    logInfo("Retrieved scripture readers from records", {
      count: scriptureReaders.length,
    });

    return scriptureReaders;
  } catch (error) {
    logError("Error getting scripture readers", error);
    // Return empty array on error
    return [];
  }
};
