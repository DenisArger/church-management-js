import { LoggerConfig } from "../types";

let loggerConfig: LoggerConfig = {
  level: (process.env.LOG_LEVEL as any) || "info",
  format: (process.env.LOG_FORMAT as any) || "json",
};

export const setLoggerConfig = (config: Partial<LoggerConfig>): void => {
  loggerConfig = { ...loggerConfig, ...config };
};

const formatMessage = (level: string, message: string, data?: any): string => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data && { data }),
  };

  if (loggerConfig.format === "json") {
    return JSON.stringify(logEntry);
  }

  return `[${timestamp}] [${level.toUpperCase()}] ${message} ${
    data ? JSON.stringify(data) : ""
  }`;
};

const shouldLog = (level: string): boolean => {
  const levels = ["debug", "info", "warn", "error"];
  const currentLevelIndex = levels.indexOf(loggerConfig.level);
  const messageLevelIndex = levels.indexOf(level);
  return messageLevelIndex >= currentLevelIndex;
};

export const logDebug = (message: string, data?: any): void => {
  if (shouldLog("debug")) {
    console.log(formatMessage("debug", message, data));
  }
};

export const logInfo = (message: string, data?: any): void => {
  if (shouldLog("info")) {
    console.log(formatMessage("info", message, data));
  }
};

export const logWarn = (message: string, data?: any): void => {
  if (shouldLog("warn")) {
    console.warn(formatMessage("warn", message, data));
  }
};

export const logError = (message: string, error?: any): void => {
  if (shouldLog("error")) {
    console.error(formatMessage("error", message, error));
  }
};
