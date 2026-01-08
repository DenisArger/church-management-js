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
} from "../types";
import { getNotionClient } from "./notionService";
import { getNotionConfig } from "../config/environment";
import { logInfo, logError, logWarn } from "../utils/logger";

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
    const dateStr = targetDate.toISOString().split("T")[0];
    const alternativeDateStr = targetDate.toLocaleDateString("en-CA"); // YYYY-MM-DD format

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

    // If no exact match, try alternative date formats
    if (response.results.length === 0) {
      response = await client.databases.query({
        database_id: databaseId,
        filter: {
          and: [
            {
              property: "Дата",
              date: { equals: alternativeDateStr },
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
      return mapNotionPageToSundayService(page as Record<string, unknown>);
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
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

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
