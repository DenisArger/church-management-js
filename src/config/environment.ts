import { config } from "dotenv";

config();

export const getTelegramConfig = () => ({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  allowedUsers: process.env.ALLOWED_USERS?.split(",").map(Number) || [],
  mainChannelId: process.env.TELEGRAM_MAIN_CHANNEL_ID,
  mainGroupId: process.env.TELEGRAM_MAIN_GROUP_ID,
  youthGroupId: process.env.TELEGRAM_YOUTH_GROUP_ID,
});

export const getNotionConfig = () => ({
  token: process.env.NOTION_TOKEN!,
  prayerDatabase: process.env.NOTION_PRAYER_DATABASE!,
  generalCalendarDatabase: process.env.NOTION_GENERAL_CALENDAR_DATABASE!,
  dailyDistributionDatabase: process.env.NOTION_DAILY_DISTRIBUTION_DATABASE!,
});

export const getAppConfig = () => ({
  nodeEnv: process.env.NODE_ENV || "development",
  logLevel: process.env.LOG_LEVEL || "info",
  logFormat: process.env.LOG_FORMAT || "json",
});

export const validateEnvironment = (): void => {
  const requiredVars = [
    "TELEGRAM_BOT_TOKEN",
    "NOTION_TOKEN",
    "NOTION_PRAYER_DATABASE",
    "NOTION_GENERAL_CALENDAR_DATABASE",
    "NOTION_DAILY_DISTRIBUTION_DATABASE",
  ];

  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};
