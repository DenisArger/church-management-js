import { Client } from "@notionhq/client";
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
import { logInfo, logError } from "../utils/logger";
import { getNotionConfig } from "../config/environment";

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
      const properties = page.properties as Record<string, unknown>;

      // Debug: Log all available properties
      logInfo("Available properties in Notion page", {
        propertyNames: Object.keys(properties),
        properties: properties,
      });

      const titleProp = properties["Название служения"] as NotionTitle;
      const dateProp = properties["Дата"] as NotionDate;
      const descriptionProp = properties["Описание"] as NotionRichText;

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
        "Информация о служении", // Use existing field from Notion
        "Примечание", // Use existing field from Notion
      ];

      let themeValue = "";
      let themeFieldName = "";

      for (const fieldName of possibleThemeFields) {
        const themeProp = properties[fieldName] as NotionRichText;
        if (
          themeProp?.rich_text?.[0]?.text?.content &&
          themeProp.rich_text[0].text.content.trim()
        ) {
          themeValue = themeProp.rich_text[0].text.content.trim();
          themeFieldName = fieldName;
          logInfo(`Found theme in field: ${fieldName}`, { theme: themeValue });
          break;
        }
      }

      // If no theme found in dedicated fields, try to extract from description
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
            themeFieldName = "Описание (extracted)";
            logInfo(`Extracted theme from description`, { theme: themeValue });
            break;
          }
        }
      }

      // Debug: Log theme field specifically
      logInfo("Theme field debug", {
        themeFieldName,
        themeValue,
        checkedFields: possibleThemeFields,
        descriptionContent: descriptionProp?.rich_text?.[0]?.text?.content,
      });

      const youthEvent: CalendarItem = {
        id: page.id as string,
        title: titleProp?.title?.[0]?.text?.content || "",
        date: new Date(
          (dateProp?.date?.start as string) || (page.created_time as string)
        ),
        description: descriptionProp?.rich_text?.[0]?.text?.content,
        theme: themeValue,
        type: "event" as const,
      };

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
