import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { LoggerConfig } from "../types";

let loggerConfig: LoggerConfig = {
  level: (process.env.LOG_LEVEL as any) || "info",
  format: (process.env.LOG_FORMAT as any) || "json",
};

let supabaseLogClient: SupabaseClient | null | undefined = undefined;

function getSupabaseLogClient(): SupabaseClient | null {
  if (supabaseLogClient !== undefined) {
    return supabaseLogClient;
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const enabled = process.env.SUPABASE_LOGS_ENABLED === "true";
  if (enabled && url && key) {
    try {
      supabaseLogClient = createClient(url, key);
    } catch {
      supabaseLogClient = null;
    }
  } else {
    supabaseLogClient = null;
  }
  return supabaseLogClient;
}

function buildLogRow(
  level: string,
  message: string,
  data?: unknown
): { ts: string; level: string; message: string; data: unknown; user_id: number | null; command: string | null; source: string | null } {
  let user_id: number | null = null;
  let command: string | null = null;
  let dataForDb: unknown = null;

  if (data != null) {
    if (data instanceof Error) {
      dataForDb = { message: data.message, name: data.name, stack: data.stack };
    } else if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;
      if ("userId" in obj) {
        user_id = typeof obj.userId === "number" ? obj.userId : null;
      }
      if ("command" in obj) {
        command = typeof obj.command === "string" ? obj.command : null;
      }
      const { userId: _u, command: _c, ...rest } = obj;
      dataForDb = Object.keys(rest).length > 0 ? rest : null;
    } else {
      dataForDb = { value: String(data) };
    }
  }

  return {
    ts: new Date().toISOString(),
    level,
    message,
    data: dataForDb,
    user_id,
    command,
    source: process.env.LOG_SOURCE || null,
  };
}

function sendToSupabase(row: Record<string, unknown>): void {
  const client = getSupabaseLogClient();
  if (!client) return;
  client
    .from("app_logs")
    .insert(row)
    .then(() => {}, (err: unknown) => console.error("Supabase log insert failed", err));
}

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
    sendToSupabase(buildLogRow("debug", message, data));
  }
};

export const logInfo = (message: string, data?: any): void => {
  if (shouldLog("info")) {
    console.log(formatMessage("info", message, data));
    sendToSupabase(buildLogRow("info", message, data));
  }
};

export const logWarn = (message: string, data?: any): void => {
  if (shouldLog("warn")) {
    console.warn(formatMessage("warn", message, data));
    sendToSupabase(buildLogRow("warn", message, data));
  }
};

export const logError = (message: string, error?: any): void => {
  if (shouldLog("error")) {
    console.error(formatMessage("error", message, error));
    sendToSupabase(buildLogRow("error", message, error));
  }
};
