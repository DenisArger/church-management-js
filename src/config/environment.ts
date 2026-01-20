import { config } from "dotenv";
import { getAppConfigValue, getAllowedUsers } from "./appConfigStore";

config();

export const getTelegramConfig = () => {
  let allowedUsers: number[] = [];
  const fromSupabase = getAllowedUsers();
  if (fromSupabase && fromSupabase.length > 0) {
    allowedUsers = fromSupabase;
  } else {
    const allowedUsersStr = process.env.ALLOWED_USERS;
    if (allowedUsersStr) {
      try {
        allowedUsers = allowedUsersStr
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
          .map(Number)
          .filter((id) => !isNaN(id));
      } catch (error) {
        console.warn("Failed to parse ALLOWED_USERS:", error);
      }
    }
  }

  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
    allowedUsers,
    youthGroupId: getAppConfigValue("TELEGRAM_YOUTH_GROUP_ID"),
    debugBotToken: process.env.TELEGRAM_BOT_TOKEN_DEBUG,
    debugChatId: getAppConfigValue("TELEGRAM_CHAT_ID_DEBUG"),
    debugTopicId: getAppConfigValue("TELEGRAM_TOPIC_ID_DEBUG"),
  };
};

export const getNotionConfig = () => ({
  token: process.env.NOTION_TOKEN!,
  prayerDatabase: process.env.NOTION_PRAYER_DATABASE!,
  generalCalendarDatabase: process.env.NOTION_GENERAL_CALENDAR_DATABASE!,
  dailyDistributionDatabase: process.env.NOTION_DAILY_DISTRIBUTION_DATABASE!,
  weeklyPrayerDatabase: process.env.NOTION_WEEKLY_PRAYER_DATABASE!,
  youthReportDatabase: process.env.NOTION_YOUTH_REPORT_DATABASE,
  youthLeadersDatabase: process.env.NOTION_YOUTH_LEADERS_DATABASE,
});

/** Normalize config value: trim, lowercase, accept "1"/"0". */
function normalizeBool(val: unknown): string {
  const s = String(val ?? "").trim().toLowerCase();
  if (s === "1") return "true";
  if (s === "0") return "false";
  return s;
}

export const getAppConfig = () => {
  const debugRaw = getAppConfigValue("DEBUG") ?? process.env.DEBUG;
  const nodeEnvRaw = getAppConfigValue("NODE_ENV") ?? process.env.NODE_ENV;
  const debugVal = normalizeBool(debugRaw);
  const nodeEnvVal = (String(nodeEnvRaw ?? "").trim().toLowerCase()) || "development";

  // isDebug: only true if DEBUG is explicitly "true"/"1", or in development and not explicitly "false"/"0"
  const isDebug =
    debugVal === "true" ||
    (nodeEnvVal === "development" && debugVal !== "false");

  return {
    nodeEnv: nodeEnvVal || "development",
    logLevel: getAppConfigValue("LOG_LEVEL") || "info",
    logFormat: getAppConfigValue("LOG_FORMAT") || "json",
    debug: isDebug,
  };
};

export const validateEnvironment = (): void => {
  const requiredVars = [
    "TELEGRAM_BOT_TOKEN",
    "NOTION_TOKEN",
    "NOTION_PRAYER_DATABASE",
    "NOTION_GENERAL_CALENDAR_DATABASE",
    "NOTION_DAILY_DISTRIBUTION_DATABASE",
    "NOTION_WEEKLY_PRAYER_DATABASE",
  ];

  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};
