import { Client } from "@notionhq/client";
import {
  PrayerNeed,
  CalendarItem,
  DailyScripture,
  CommandResult,
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

    const prayerNeeds: PrayerNeed[] = response.results.map((page: any) => ({
      id: page.id,
      text: page.properties["Текст"]?.rich_text?.[0]?.text?.content || "",
      author: page.properties["Автор"]?.rich_text?.[0]?.text?.content || "",
      date: new Date(page.properties["Дата"]?.date?.start || page.created_time),
      status: "active",
      category: page.properties["Категория"]?.select?.name,
    }));

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

    const filter: any = {};

    if (startDate && endDate) {
      filter.and = [
        {
          property: "Дата",
          date: { on_or_after: startDate.toISOString().split("T")[0] },
        },
        {
          property: "Дата",
          date: { on_or_before: endDate.toISOString().split("T")[0] },
        },
      ];
    }

    const response = await client.databases.query({
      database_id: config.generalCalendarDatabase,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });

    const calendarItems: CalendarItem[] = response.results.map((page: any) => ({
      id: page.id,
      title: page.properties["Название"]?.title?.[0]?.text?.content || "",
      date: new Date(page.properties["Дата"]?.date?.start || page.created_time),
      description: page.properties["Описание"]?.rich_text?.[0]?.text?.content,
      type: page.properties["Тип"]?.select?.name?.toLowerCase() || "event",
    }));

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
    const scripture: DailyScripture = {
      id: page.id,
      date: new Date(page.properties["Дата"]?.date?.start || page.created_time),
      text: page.properties["Текст"]?.rich_text?.[0]?.text?.content || "",
      reference: page.properties["Ссылка"]?.rich_text?.[0]?.text?.content || "",
      translation:
        page.properties["Перевод"]?.rich_text?.[0]?.text?.content || "",
    };

    logInfo("Daily scripture retrieved", { scriptureId: scripture.id });
    return scripture;
  } catch (error) {
    logError("Error getting daily scripture", error);
    return null;
  }
};
