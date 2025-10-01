export interface TelegramUser {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: {
    id: number;
    type: string;
    title?: string;
  };
  text?: string;
  date: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  poll?: any;
  poll_answer?: any;
}

export interface PrayerNeed {
  id: string;
  text: string;
  author: string;
  date: Date;
  status: "active" | "answered" | "archived";
  category?: string;
}

export interface CalendarItem {
  id: string;
  title: string;
  date: Date;
  description?: string;
  type: "service" | "meeting" | "event";
}

export interface DailyScripture {
  id: string;
  date: Date;
  text: string;
  reference: string;
  translation: string;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export interface LoggerConfig {
  level: "debug" | "info" | "warn" | "error";
  format: "json" | "text";
}
