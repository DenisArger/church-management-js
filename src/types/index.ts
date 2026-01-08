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
  forward_from?: TelegramUser;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
  chat_instance?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  poll?: {
    id: string;
    question: string;
    options: Array<{ text: string; voter_count: number }>;
    total_voter_count: number;
    is_closed: boolean;
    is_anonymous: boolean;
    type: string;
    allows_multiple_answers: boolean;
  };
  poll_answer?: {
    poll_id: string;
    user: TelegramUser;
    option_ids: number[];
  };
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
  theme?: string;
  type: "service" | "meeting" | "event";
  serviceType?: string; // Type of service from Notion (e.g., "Молодежное", "МОСТ")
}

export interface DailyScripture {
  id: string;
  date: Date;
  text: string;
  reference: string;
  translation: string;
}

export interface PrayerRecord {
  id: string;
  person: string;
  topic: string;
  note: string;
  column?: string;
  dateStart: Date;
  dateEnd: Date;
}

export interface WeeklyPrayerInput {
  person: string;
  topic: string;
  note?: string;
  weekType: "current" | "next";
  dateStart: Date;
  dateEnd: Date;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface LoggerConfig {
  level: "debug" | "info" | "warn" | "error";
  format: "json" | "text";
}

// Notion API types
export interface NotionPage {
  id: string;
  properties: Record<string, unknown>;
  created_time: string;
}

export interface NotionRichText {
  rich_text?: Array<{
    text?: {
      content?: string;
    };
  }>;
}

export interface NotionSelect {
  select?: {
    name?: string;
  };
}

export interface NotionDate {
  date?: {
    start?: string;
    end?: string;
  };
}

export interface NotionTitle {
  title?: Array<{
    text?: {
      content?: string;
    };
    plain_text?: string;
  }>;
}

export interface NotionSelectProperty {
  select?: {
    name?: string;
  };
}

// Sunday Service types
export interface NotionMultiSelectOption {
  id: string;
  name: string;
  color: string;
}

export interface NotionMultiSelect {
  multi_select?: NotionMultiSelectOption[];
}

export interface NotionCheckbox {
  checkbox?: boolean;
}

export interface NotionNumber {
  number?: number;
}

export interface SundayServiceItem {
  id: string;
  title: string;
  date: Date;
  type: string;
  preachers: NotionMultiSelectOption[];
  worshipService: string;
  songBeforeStart: boolean;
  numWorshipSongs: number | null;
  soloSong: boolean;
  repentanceSong: boolean;
  scriptureReading: string;
  scriptureReader: string;
}

export interface SundayServiceInfo {
  date: Date;
  services: SundayServiceItem[];
}

// Weekly Schedule types
export interface WeeklyServiceItem {
  id: string;
  title: string;
  date: Date;
  time?: string;
  type: string;
  description?: string;
  location?: string;
  needsMailing: boolean;
}

export interface WeeklyScheduleInfo {
  startDate: Date;
  endDate: Date;
  services: WeeklyServiceItem[];
}

// Sunday Service Form types
export type SundayServiceMode = "create" | "edit";
export type SundayServiceStream = "1" | "2" | "both";
export type SundayServiceStep =
  | "mode"
  | "date"
  | "stream"
  | "title"
  | "preachers"
  | "worshipService"
  | "songBeforeStart"
  | "numWorshipSongs"
  | "soloSong"
  | "repentanceSong"
  | "scriptureReading"
  | "scriptureReader"
  | "review"
  | "completed";

export interface SundayServiceFormData {
  mode?: SundayServiceMode;
  date?: Date;
  stream?: SundayServiceStream;
  serviceId?: string; // For edit mode
  title?: string;
  preachers?: string[];
  worshipService?: string;
  songBeforeStart?: boolean;
  numWorshipSongs?: number | null;
  soloSong?: boolean;
  repentanceSong?: boolean;
  scriptureReading?: string;
  scriptureReader?: string;
  currentStream?: "1" | "2"; // When filling both streams
  stream1Data?: Partial<SundayServiceFormData>;
  stream2Data?: Partial<SundayServiceFormData>;
  preachersPage?: number; // Current page for preachers selection
  worshipServicesList?: string[]; // Cached list of worship services for callback data
  scriptureReadersList?: string[]; // Cached list of scripture readers for callback data
}

export interface SundayServiceState {
  userId: number;
  chatId: number;
  step: SundayServiceStep;
  data: SundayServiceFormData;
  messageId?: number; // ID of the message with inline keyboard
  waitingForTextInput?: boolean; // True when waiting for text input
}

// Schedule Form types
export type ScheduleFormMode = "create" | "edit";
export type ScheduleFormStep =
  | "mode"
  | "select_week"
  | "preview_week"
  | "date"
  | "select_service"
  | "title"
  | "review"
  | "completed";

export interface ScheduleFormData {
  mode?: ScheduleFormMode;
  weekType?: "current" | "next"; // For edit mode - selected week
  date?: Date;
  title?: string;
  serviceId?: string; // For edit mode
}

export interface ScheduleState {
  userId: number;
  chatId: number;
  step: ScheduleFormStep;
  data: ScheduleFormData;
  messageId?: number; // ID of the message with inline keyboard
  waitingForTextInput?: boolean; // True when waiting for text input
}
