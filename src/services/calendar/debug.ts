import {
  NotionTitle,
  NotionDate,
  NotionSelect,
} from "../../types";
import { getNotionClient } from "../notionService";
import { getNotionConfig } from "../../config/environment";
import { logInfo, logError } from "../../utils/logger";

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
