import { Client } from "@notionhq/client";
import { createClient } from "@supabase/supabase-js";
import {
  PrayerNeed,
  CalendarItem,
  DailyScripture,
  PrayerRecord,
  WeeklyPrayerInput,
  CommandResult,
  NotionRichText,
  NotionSelect,
  NotionDate,
  NotionTitle,
} from "../types";
import { logInfo, logError, logWarn } from "../utils/logger";
import { getNotionConfig } from "../config/environment";
import { formatDateForNotion } from "../utils/dateHelper";

let notionClient: Client | null = null;

export const getNotionClient = (): Client => {
  if (!notionClient) {
    const config = getNotionConfig();
    notionClient = new Client({ auth: config.token });
    logInfo("Notion client initialized");
  }
  return notionClient;
};

export const createPrayerNeed = async (
  text: string,
  author: string,
  category?: string
): Promise<CommandResult> => {
  try {
    const client = getNotionClient();
    const config = getNotionConfig();

    const response = await client.pages.create({
      parent: { database_id: config.prayerDatabase },
      properties: {
        Текст: {
          rich_text: [{ text: { content: text } }],
        },
        Автор: {
          rich_text: [{ text: { content: author } }],
        },
        Дата: {
          date: { start: new Date().toISOString().split("T")[0] },
        },
        Статус: {
          select: { name: "Активная" },
        },
        ...(category && {
          Категория: {
            select: { name: category },
          },
        }),
      },
    });

    logInfo("Prayer need created", { pageId: response.id });

    return {
      success: true,
      message: "Prayer need created successfully",
      data: { pageId: response.id },
    };
  } catch (error) {
    logError("Error creating prayer need", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

export const getActivePrayerNeeds = async (): Promise<PrayerNeed[]> => {
  try {
    const client = getNotionClient();
    const config = getNotionConfig();

    const response = await client.databases.query({
      database_id: config.prayerDatabase,
      filter: {
        property: "Статус",
        select: { equals: "Активная" },
      },
    });

    const prayerNeeds: PrayerNeed[] = response.results.map((page: any) => {
      const textProp = page.properties["Текст"] as NotionRichText;
      const authorProp = page.properties["Автор"] as NotionRichText;
      const dateProp = page.properties["Дата"] as NotionDate;
      const categoryProp = page.properties["Категория"] as NotionSelect;

      return {
        id: page.id,
        text: textProp?.rich_text?.[0]?.text?.content || "",
        author: authorProp?.rich_text?.[0]?.text?.content || "",
        date: new Date(dateProp?.date?.start || page.created_time),
        status: "active" as const,
        category: categoryProp?.select?.name,
      };
    });

    logInfo(`Retrieved ${prayerNeeds.length} active prayer needs`);
    return prayerNeeds;
  } catch (error) {
    logError("Error getting prayer needs", error);
    return [];
  }
};

export const getCalendarItems = async (
  startDate?: Date,
  endDate?: Date
): Promise<CalendarItem[]> => {
  try {
    const client = getNotionClient();
    const config = getNotionConfig();

    let filter: any = undefined;

    if (startDate && endDate) {
      filter = {
        and: [
          {
            property: "Дата",
            date: { on_or_after: startDate.toISOString().split("T")[0] },
          },
          {
            property: "Дата",
            date: { on_or_before: endDate.toISOString().split("T")[0] },
          },
        ],
      };
    }

    const response = await client.databases.query({
      database_id: config.generalCalendarDatabase,
      filter,
    });

    const calendarItems: CalendarItem[] = response.results.map((page: any) => {
      const titleProp = page.properties["Название"] as NotionTitle;
      const dateProp = page.properties["Дата"] as NotionDate;
      const descriptionProp = page.properties["Описание"] as NotionRichText;
      const typeProp = page.properties["Тип"] as NotionSelect;

      return {
        id: page.id,
        title: titleProp?.title?.[0]?.text?.content || "",
        date: new Date(dateProp?.date?.start || page.created_time),
        description: descriptionProp?.rich_text?.[0]?.text?.content,
        type:
          (typeProp?.select?.name?.toLowerCase() as
            | "service"
            | "meeting"
            | "event") || "event",
      };
    });

    logInfo(`Retrieved ${calendarItems.length} calendar items`);
    return calendarItems;
  } catch (error) {
    logError("Error getting calendar items", error);
    return [];
  }
};

export const getDailyScripture = async (
  date?: Date
): Promise<DailyScripture | null> => {
  try {
    const client = getNotionClient();
    const config = getNotionConfig();
    const targetDate = date || new Date();

    const response = await client.databases.query({
      database_id: config.dailyDistributionDatabase,
      filter: {
        property: "Дата",
        date: { equals: targetDate.toISOString().split("T")[0] },
      },
    });

    if (response.results.length === 0) {
      logInfo("No daily scripture found for date", { date: targetDate });
      return null;
    }

    const page = response.results[0] as any;
    const dateProp = page.properties["Дата"] as NotionDate;
    const textProp = page.properties["Текст"] as NotionRichText;
    const referenceProp = page.properties["Ссылка"] as NotionRichText;
    const translationProp = page.properties["Перевод"] as NotionRichText;

    const scripture: DailyScripture = {
      id: page.id,
      date: new Date(dateProp?.date?.start || page.created_time),
      text: textProp?.rich_text?.[0]?.text?.content || "",
      reference: referenceProp?.rich_text?.[0]?.text?.content || "",
      translation: translationProp?.rich_text?.[0]?.text?.content || "",
    };

    logInfo("Daily scripture retrieved", { scriptureId: scripture.id });
    return scripture;
  } catch (error) {
    logError("Error getting daily scripture", error);
    return null;
  }
};

export const getWeeklyPrayerRecords = async (): Promise<PrayerRecord[]> => {
  try {
    const client = getNotionClient();
    const config = getNotionConfig();

    logInfo("Getting weekly prayer records", {
      databaseId: config.weeklyPrayerDatabase,
    });

    const response = await client.databases.query({
      database_id: config.weeklyPrayerDatabase,
    });

    logInfo("Notion response received", {
      resultsCount: response.results?.length || 0,
    });

    if (!response.results || response.results.length === 0) {
      logInfo("No weekly prayer records found");
      return [];
    }

    const prayerRecords: PrayerRecord[] = [];
    let processedCount = 0;
    let skippedCount = 0;

    for (let idx = 0; idx < response.results.length; idx++) {
      const page = response.results[idx] as any;

      try {
        logInfo(`Processing record ${idx + 1}`, {
          pageId: page.id,
          properties: Object.keys(page.properties || {}),
        });

        // Get prayer date
        const dateProperty = page.properties["Дата молитвы"] as NotionDate;
        if (!dateProperty || !dateProperty.date) {
          logInfo(`Skipping record ${idx + 1}: no date property`, {
            dateProperty: dateProperty,
          });
          skippedCount++;
          continue;
        }

        const startDate = dateProperty.date.start;
        const endDate = dateProperty.date.end;

        if (!startDate || !endDate) {
          logInfo(`Skipping record ${idx + 1}: missing start or end date`, {
            startDate,
            endDate,
          });
          skippedCount++;
          continue;
        }

        // Get prayer person
        const personProperty = page.properties[
          "Молитвенное лицо"
        ] as NotionSelect;
        if (!personProperty || !personProperty.select) {
          logInfo(`Skipping record ${idx + 1}: no person property`, {
            personProperty: personProperty,
          });
          skippedCount++;
          continue;
        }

        const personName = personProperty.select.name;
        if (!personName) {
          logInfo(`Skipping record ${idx + 1}: no person name`, {
            personName,
          });
          skippedCount++;
          continue;
        }

        // Get other fields
        const topicProp = page.properties["Тема молитвы"] as NotionRichText;
        const noteProp = page.properties["Примечание"] as NotionTitle;
        const columnProp = page.properties["Column"] as NotionTitle;

        const topic = topicProp?.rich_text?.[0]?.text?.content || "";
        const note = noteProp?.title?.[0]?.text?.content || "";
        const column = columnProp?.title?.[0]?.text?.content;

        const prayerRecord: PrayerRecord = {
          id: page.id,
          person: personName,
          topic,
          note,
          column,
          dateStart: new Date(startDate),
          dateEnd: new Date(endDate),
        };

        prayerRecords.push(prayerRecord);
        processedCount++;

        logInfo(`Successfully processed record ${idx + 1}`, {
          person: personName,
          dateStart: startDate,
          topic: topic.substring(0, 50) + (topic.length > 50 ? "..." : ""),
        });
      } catch (error) {
        logError(`Error processing prayer record ${idx + 1}`, error);
        skippedCount++;
        continue;
      }
    }

    logInfo(`Weekly prayer records processing complete`, {
      total: response.results.length,
      processed: processedCount,
      skipped: skippedCount,
      final: prayerRecords.length,
    });

    return prayerRecords;
  } catch (error) {
    logError("Error getting weekly prayer records", error);
    return [];
  }
};

export const createWeeklyPrayerRecord = async (
  prayerInput: WeeklyPrayerInput
): Promise<CommandResult> => {
  try {
    const client = getNotionClient();
    const config = getNotionConfig();

    logInfo("Creating weekly prayer record", {
      person: prayerInput.person,
      topic: prayerInput.topic,
      weekType: prayerInput.weekType,
      dateStart: prayerInput.dateStart,
      dateEnd: prayerInput.dateEnd,
    });

    // Use local date format to avoid timezone issues
    const startDateStr =
      prayerInput.dateStart.getFullYear() +
      "-" +
      String(prayerInput.dateStart.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(prayerInput.dateStart.getDate()).padStart(2, "0");
    const endDateStr =
      prayerInput.dateEnd.getFullYear() +
      "-" +
      String(prayerInput.dateEnd.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(prayerInput.dateEnd.getDate()).padStart(2, "0");

    console.log("=== DEBUG: Notion API dates ===");
    console.log("Original start date:", prayerInput.dateStart.toISOString());
    console.log("Original end date:", prayerInput.dateEnd.toISOString());
    console.log("Start date string for Notion:", startDateStr);
    console.log("End date string for Notion:", endDateStr);
    console.log(
      "Start date day of week:",
      prayerInput.dateStart.getDay(),
      "(0=Sunday, 1=Monday, etc.)"
    );
    console.log(
      "End date day of week:",
      prayerInput.dateEnd.getDay(),
      "(0=Sunday, 1=Monday, etc.)"
    );

    const response = await client.pages.create({
      parent: { database_id: config.weeklyPrayerDatabase },
      properties: {
        "Дата молитвы": {
          date: {
            start: startDateStr,
            end: endDateStr,
          },
        },
        "Молитвенное лицо": {
          select: { name: prayerInput.person },
        },
        "Тема молитвы": {
          rich_text: [{ text: { content: prayerInput.topic } }],
        },
        Примечание: {
          title: prayerInput.note
            ? [{ text: { content: prayerInput.note } }]
            : [],
        },
        Column: {
          title: [{ text: { content: prayerInput.weekType } }],
        },
      },
    });

    logInfo("Weekly prayer record created successfully", {
      pageId: response.id,
      person: prayerInput.person,
    });

    return {
      success: true,
      message: "Молитвенная запись успешно создана",
      data: { pageId: response.id },
    };
  } catch (error) {
    logError("Error creating weekly prayer record", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Extract theme from Notion page properties
 */
const extractThemeFromProperties = (
  properties: Record<string, unknown>
): string => {
  const descriptionProp = properties["Описание"] as NotionRichText;
  const titleProp = properties["Название служения"] as NotionTitle;

  // Try different possible field names for theme
  const possibleThemeFields = [
    "Тема",
    "Topic",
    "Тема служения",
    "Service Theme",
    "Тема встречи",
    "Meeting Theme",
    "Содержание",
    "Content",
    "Тематика",
    "Subject",
    "Информация о служении",
    "Примечание",
  ];

  let themeValue = "";

  for (const fieldName of possibleThemeFields) {
    const themeProp = properties[fieldName] as NotionRichText;
    if (
      themeProp?.rich_text?.[0]?.text?.content &&
      themeProp.rich_text[0].text.content.trim()
    ) {
      themeValue = themeProp.rich_text[0].text.content.trim();
      logInfo(`Found theme in field: ${fieldName}`, { theme: themeValue });
      break;
    }
  }

  // If no theme found in dedicated fields, try to extract from title
  if (!themeValue && titleProp?.title?.[0]?.text?.content) {
    const title = titleProp.title[0].text.content;

    // Look for theme patterns in title (e.g., "Тема:"..." or "Тема:"..."")
    const themePatterns = [
      /Тема:\s*["']([^"']+)["']/i,  // Тема:"..." or Тема:'...'
      /Тема:\s*([^.\n]+)/i,          // Тема: ... (until dot or newline)
      /тема:\s*["']([^"']+)["']/i,  // тема:"..." or тема:'...'
      /тема:\s*([^.\n]+)/i,          // тема: ... (until dot or newline)
    ];

    for (const pattern of themePatterns) {
      const match = title.match(pattern);
      if (match && match[1]) {
        themeValue = match[1].trim();
        logInfo(`Extracted theme from title`, { theme: themeValue });
        break;
      }
    }
  }

  // If no theme found, try to extract from description
  if (!themeValue && descriptionProp?.rich_text?.[0]?.text?.content) {
    const description = descriptionProp.rich_text[0].text.content;

    // Look for theme patterns in description
    const themePatterns = [
      /Тема:\s*(.+)/i,
      /тема:\s*(.+)/i,
      /Theme:\s*(.+)/i,
      /["']([^"']+)["']/, // Theme in quotes
    ];

    for (const pattern of themePatterns) {
      const match = description.match(pattern);
      if (match) {
        themeValue = match[1].trim();
        logInfo(`Extracted theme from description`, { theme: themeValue });
        break;
      }
    }
  }

  return themeValue;
};

/**
 * Map Notion page to CalendarItem
 */
const mapNotionPageToCalendarItem = (
  page: Record<string, unknown>
): CalendarItem => {
  const properties = page.properties as Record<string, unknown>;

  const titleProp = properties["Название служения"] as NotionTitle;
  const dateProp = properties["Дата"] as NotionDate;
  const descriptionProp = properties["Описание"] as NotionRichText;
  const serviceTypeProp = properties["Тип служения"] as NotionSelect;

  const themeValue = extractThemeFromProperties(properties);

  const rawDate = (dateProp?.date?.start as string) || (page.created_time as string);
  const eventDate = new Date(rawDate);

  return {
    id: page.id as string,
    title: titleProp?.title?.[0]?.text?.content || "",
    date: eventDate,
    description: descriptionProp?.rich_text?.[0]?.text?.content,
    theme: themeValue,
    type: "event" as const,
    serviceType: serviceTypeProp?.select?.name,
  };
};

/**
 * Get youth events (МОСТ and Молодежное) for a date range
 */
export const getYouthEventsForDateRange = async (
  startDate: Date,
  endDate: Date,
  eventTypes: string[] = ["Молодежное", "МОСТ"]
): Promise<CalendarItem[]> => {
  try {
    const client = getNotionClient();
    const config = getNotionConfig();

    // Use formatDateForNotion to ensure consistent date formatting with local time
    // This avoids timezone issues when converting dates
    const startDateStr = formatDateForNotion(startDate);
    const endDateStr = formatDateForNotion(endDate);

    logInfo("Searching for youth events in date range", {
      startDate: startDateStr,
      endDate: endDateStr,
      startDateISO: startDate.toISOString(),
      endDateISO: endDate.toISOString(),
      eventTypes,
    });

    // Build filter for event types
    const typeFilters = eventTypes.map((eventType) => ({
      property: "Тип служения",
      select: { equals: eventType },
    }));

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
          {
            or: typeFilters,
          },
        ],
      },
    });

    logInfo("Notion query response for youth events", {
      resultsCount: response.results.length,
      queryFilter: {
        dateRange: {
          start: startDateStr,
          end: endDateStr,
        },
        eventTypes,
      },
    });

    if (response.results.length === 0) {
      logInfo("No youth events found in date range", {
        startDate: startDateStr,
        endDate: endDateStr,
        startDateISO: startDate.toISOString(),
        endDateISO: endDate.toISOString(),
        eventTypes,
      });
      return [];
    }

    const events: CalendarItem[] = response.results.map((page: unknown) => {
      return mapNotionPageToCalendarItem(page as Record<string, unknown>);
    });

    logInfo("Youth events found in date range", {
      count: events.length,
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date.toISOString(),
        hasTheme: !!e.theme,
      })),
    });

    return events;
  } catch (error) {
    logError("Error getting youth events for date range", error);
    return [];
  }
};

export const getYouthEventForTomorrow =
  async (): Promise<CalendarItem | null> => {
    try {
      const client = getNotionClient();
      const config = getNotionConfig();

      // Calculate tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      logInfo("Searching for youth event tomorrow", {
        tomorrowDate: tomorrowStr,
      });

      const response = await client.databases.query({
        database_id: config.generalCalendarDatabase,
        filter: {
          and: [
            {
              property: "Дата",
              date: { equals: tomorrowStr },
            },
            {
              property: "Тип служения",
              select: { equals: "Молодежное" },
            },
          ],
        },
      });

      if (response.results.length === 0) {
        logInfo("No youth event found for tomorrow");
        return null;
      }

      const page = response.results[0] as Record<string, unknown>;
      const youthEvent = mapNotionPageToCalendarItem(page);

      logInfo("Youth event found for tomorrow", {
        eventId: youthEvent.id,
        title: youthEvent.title,
        description: youthEvent.description,
        theme: youthEvent.theme,
        date: youthEvent.date.toISOString(),
        type: youthEvent.type,
      });

      logInfo("Final youth event data for poll", {
        title: youthEvent.title,
        description: youthEvent.description,
        theme: youthEvent.theme,
        hasTheme: !!youthEvent.theme,
        themeLength: youthEvent.theme?.length || 0,
      });

      return youthEvent;
    } catch (error) {
      logError("Error getting youth event for tomorrow", error);
      return null;
    }
  };

/**
 * Get leader name by Telegram user ID
 * Uses Notion database with caching
 */
export const getLeaderByTelegramId = async (
  telegramId: number
): Promise<string | null> => {
  try {
    const mapping = await getYouthLeadersMapping();
    const leaderName = mapping.get(telegramId);
    
    if (leaderName) {
      logInfo("Leader found by Telegram ID", { telegramId, leader: leaderName });
      return leaderName;
    }

    logWarn("Leader not found for Telegram ID", { telegramId });
    return null;
  } catch (error) {
    logError("Error getting leader by Telegram ID", error);
    return null;
  }
};

/**
 * Get list of people assigned to a leader from Notion database
 * Gets people from existing reports filtered by leader, or from database schema options
 */
export const getYouthPeopleForLeader = async (
  leader: string
): Promise<string[]> => {
  try {
    const client = getNotionClient();
    const config = getNotionConfig();

    if (!config.youthReportDatabase) {
      const errorMessage = "NOTION_YOUTH_REPORT_DATABASE not configured";
      logError(errorMessage);
      
      // Try to send notification to admin (but don't fail if it doesn't work)
      try {
        const { getTelegramConfig } = await import("../config/environment");
        const { sendMessageToUser } = await import("../services/telegramService");
        const telegramConfig = getTelegramConfig();
        const adminUsers = telegramConfig.allowedUsers;
        
        if (adminUsers.length > 0) {
          const adminUserId = adminUsers[0];
          const message = `❌ ОШИБКА: Не удалось сформировать список людей для лидера\n\n` +
            `Лидер: ${leader}\n` +
            `Ошибка: ${errorMessage}\n\n` +
            `Пожалуйста, проверьте настройку переменной окружения NOTION_YOUTH_REPORT_DATABASE.`;
          
          await sendMessageToUser(adminUserId, message).catch(() => {
            // Ignore notification errors
          });
        }
      } catch (notificationError) {
        // Ignore notification errors - we don't want to break the main flow
        logWarn("Failed to send admin notification for missing database config", notificationError);
      }
      
      return [];
    }

    logInfo("Getting youth people for leader", {
      leader,
      databaseId: config.youthReportDatabase,
    });

    // First, try to get options from database schema
    try {
      const database = await client.databases.retrieve({
        database_id: config.youthReportDatabase,
      });

      const personProperty = database.properties["Человек"] as any;

      if (
        personProperty &&
        personProperty.type === "select" &&
        personProperty.select?.options
      ) {
        // If we have options from schema, filter by existing reports for this leader
        // to show only people that this leader has worked with
        // Handle pagination to get all records
        const peopleSet = new Set<string>();
        let hasMore = true;
        let nextCursor: string | undefined = undefined;

        while (hasMore) {
          const response = await client.databases.query({
            database_id: config.youthReportDatabase,
            filter: {
              property: "Лидер",
              select: { equals: leader },
            },
            page_size: 100,
            start_cursor: nextCursor,
          });

          response.results.forEach((page: any) => {
            const personProp = page.properties["Человек"] as NotionSelect;
            if (personProp?.select?.name) {
              peopleSet.add(personProp.select.name);
            }
          });

          hasMore = response.has_more || false;
          nextCursor = response.next_cursor || undefined;
        }

        const people = Array.from(peopleSet).sort();
        
        // If no reports found, return empty array (don't show all options)
        if (people.length === 0) {
          logInfo("No reports found for leader", {
            leader,
          });
          return [];
        }

        logInfo(`Retrieved ${people.length} people for leader from reports`, {
          leader,
          peopleCount: people.length,
        });
        return people;
      }
    } catch (schemaError) {
      logWarn("Could not get people from schema", schemaError);
    }

    // Fallback: get unique values from existing records filtered by leader
    // Handle pagination for fallback query too
    const peopleSet = new Set<string>();
    let hasMore = true;
    let nextCursor: string | undefined = undefined;

    while (hasMore) {
      const response = await client.databases.query({
        database_id: config.youthReportDatabase,
        filter: {
          property: "Лидер",
          select: { equals: leader },
        },
        page_size: 100,
        start_cursor: nextCursor,
      });

      response.results.forEach((page: any) => {
        const personProp = page.properties["Человек"] as NotionSelect;
        if (personProp?.select?.name) {
          peopleSet.add(personProp.select.name);
        }
      });

      hasMore = response.has_more || false;
      nextCursor = response.next_cursor ? response.next_cursor : undefined;
    }

    const people = Array.from(peopleSet).sort();
    
    logInfo(`Retrieved ${people.length} people for leader from records`, {
      leader,
      peopleCount: people.length,
    });

    return people;
  } catch (error) {
    logError("Error getting youth people for leader", error);
    return [];
  }
};

/**
 * Create youth report record in Notion
 */
export const createYouthReportRecord = async (
  reportInput: {
    person: string;
    leader: string;
    date: Date;
    communicationTypes: string[];
    events: string[];
    help?: string;
    note?: string;
  }
): Promise<CommandResult> => {
  try {
    const client = getNotionClient();
    const config = getNotionConfig();

    if (!config.youthReportDatabase) {
      return {
        success: false,
        error: "NOTION_YOUTH_REPORT_DATABASE not configured",
      };
    }

    logInfo("Creating youth report record", {
      person: reportInput.person,
      leader: reportInput.leader,
      date: reportInput.date,
    });

    // Format date for Notion
    const dateStr = formatDateForNotion(reportInput.date);

    // Prepare multi-select options for communication types
    const communicationOptions = reportInput.communicationTypes.map((type) => ({
      name: type,
    }));

    // Prepare multi-select options for events
    const eventsOptions = reportInput.events.map((event) => ({
      name: event,
    }));

    // Generate title for the report
    const reportTitle = `Отчет по работе с ${reportInput.person}`;

    const response = await client.pages.create({
      parent: { database_id: config.youthReportDatabase },
      properties: {
        Название: {
          title: [{ text: { content: reportTitle } }],
        },
        Человек: {
          select: { name: reportInput.person },
        },
        Лидер: {
          select: { name: reportInput.leader },
        },
        "Дата отчета": {
          date: { start: dateStr },
        },
        "Способы общения": {
          multi_select: communicationOptions,
        },
        Мероприятия: {
          multi_select: eventsOptions,
        },
        Помощь: {
          rich_text: reportInput.help
            ? [{ text: { content: reportInput.help } }]
            : [],
        },
        Примечание: {
          rich_text: reportInput.note
            ? [{ text: { content: reportInput.note } }]
            : [],
        },
      },
    });

    logInfo("Youth report record created successfully", {
      pageId: response.id,
      person: reportInput.person,
      leader: reportInput.leader,
    });

    return {
      success: true,
      message: "Отчет успешно создан",
      data: { pageId: response.id },
    };
  } catch (error) {
    logError("Error creating youth report record", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// Кэш для маппинга лидеров (обновляется каждые 5 минут)
let youthLeadersCache: Map<number, string> | null = null;
let youthLeadersCacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

/**
 * Получить маппинг молодежных лидеров из Notion
 * Использует кэш для оптимизации производительности
 */
export const getYouthLeadersMapping = async (): Promise<Map<number, string>> => {
  const now = Date.now();
  
  // Возвращаем кэш, если он еще актуален
  if (youthLeadersCache && (now - youthLeadersCacheTimestamp) < CACHE_TTL) {
    return youthLeadersCache;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await supabase
          .from("youth_leaders")
          .select("telegram_id, name")
          .eq("is_active", true);
        if (!error && data && data.length > 0) {
          const mapping = new Map<number, string>();
          data.forEach((r) => mapping.set(Number(r.telegram_id), r.name));
          youthLeadersCache = mapping;
          youthLeadersCacheTimestamp = now;
          logInfo(`Loaded ${mapping.size} youth leaders from Supabase`);
          return mapping;
        }
      } catch (e) {
        logWarn("Supabase youth_leaders load failed, trying Notion", e);
      }
    }

    const client = getNotionClient();
    const config = getNotionConfig();

    if (!config.youthLeadersDatabase) {
      logWarn("NOTION_YOUTH_LEADERS_DATABASE not configured, falling back to env");
      return getYouthLeadersFromEnv();
    }

    logInfo("Loading youth leaders from Notion", {
      databaseId: config.youthLeadersDatabase,
    });

    const response = await client.databases.query({
      database_id: config.youthLeadersDatabase,
      filter: {
        property: "Активен",
        checkbox: { equals: true },
      },
    });

    const mapping = new Map<number, string>();

    for (const page of response.results) {
      const properties = (page as any).properties;
      
      const nameProperty = properties["Имя"];
      const telegramIdProperty = properties["Telegram ID"];
      const activeProperty = properties["Активен"];

      if (
        nameProperty?.title?.[0]?.plain_text &&
        telegramIdProperty?.number !== undefined &&
        activeProperty?.checkbox === true
      ) {
        const name = nameProperty.title[0].plain_text;
        const telegramId = Math.floor(telegramIdProperty.number);
        
        mapping.set(telegramId, name);
        logInfo("Loaded youth leader", { telegramId, name });
      }
    }

    // Обновляем кэш
    youthLeadersCache = mapping;
    youthLeadersCacheTimestamp = now;

    logInfo(`Loaded ${mapping.size} active youth leaders from Notion`);
    return mapping;
  } catch (error) {
    logError("Error loading youth leaders from Notion", error);
    // Fallback на переменную окружения
    return getYouthLeadersFromEnv();
  }
};

/**
 * Fallback: получить маппинг из переменной окружения
 */
const getYouthLeadersFromEnv = (): Map<number, string> => {
  const mapping = new Map<number, string>();
  const leaderMappingStr = process.env.YOUTH_LEADER_MAPPING;
  
  if (leaderMappingStr) {
    const mappings = leaderMappingStr.split(",").map((m) => m.trim());
    for (const mappingStr of mappings) {
      const [idStr, leaderName] = mappingStr.split(":").map((s) => s.trim());
      const id = parseInt(idStr, 10);
      if (!isNaN(id) && leaderName) {
        mapping.set(id, leaderName);
      }
    }
  }
  
  return mapping;
};

/**
 * Инвалидировать кэш лидеров (вызывать после изменений в Notion)
 */
export const invalidateYouthLeadersCache = (): void => {
  youthLeadersCache = null;
  youthLeadersCacheTimestamp = 0;
  logInfo("Youth leaders cache invalidated");
};
