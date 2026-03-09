import { TelegramMessage } from "../types";

type PrayerRelayConfig = {
  enabled: boolean;
  mainGroupId: number | null;
  prayersTopicId: number | null;
  keywords: string[];
};

const GENERAL_TOPIC_THREAD_ID = 1;

const normalizeText = (text: string): string =>
  text.trim().toLocaleLowerCase("ru-RU");

const parseId = (value?: string | null): number | null => {
  if (!value) {
    return null;
  }

  const parsed = parseInt(value.trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const parsePrayerRelayKeywords = (value?: string | null): string[] =>
  String(value ?? "")
    .split(",")
    .map((keyword) => normalizeText(keyword))
    .filter((keyword) => keyword.length > 0);

export const getPrayerRelayConfig = (
  telegramConfig: Record<string, unknown>
): PrayerRelayConfig => {
  const enabledValue = String(
    telegramConfig.prayerRelayEnabled ?? ""
  ).trim().toLowerCase();
  const enabled =
    enabledValue === "true" || enabledValue === "1" || enabledValue === "yes";

  return {
    enabled,
    mainGroupId: parseId(telegramConfig.mainGroupId as string | undefined),
    prayersTopicId: parseId(
      telegramConfig.mainGroupPrayersTopicId as string | undefined
    ),
    keywords: parsePrayerRelayKeywords(
      telegramConfig.prayerRelayKeywords as string | undefined
    ),
  };
};

const isMessageFromBot = (message: TelegramMessage): boolean =>
  message.from?.is_bot === true;

const isMessageInGeneralTopic = (
  message: TelegramMessage,
  prayersTopicId: number
): boolean => {
  if (message.message_thread_id === prayersTopicId) {
    return false;
  }

  if (
    message.message_thread_id !== undefined &&
    message.message_thread_id !== GENERAL_TOPIC_THREAD_ID
  ) {
    return false;
  }

  return true;
};

const messageMatchesKeywords = (
  message: TelegramMessage,
  keywords: string[]
): boolean => {
  if (!message.text || keywords.length === 0) {
    return false;
  }

  const normalizedMessage = normalizeText(message.text);
  return keywords.some((keyword) => normalizedMessage.includes(keyword));
};

export const shouldRelayPrayerMessage = (
  message: TelegramMessage,
  config: PrayerRelayConfig
): { shouldRelay: boolean; reason?: string } => {
  if (!config.enabled) {
    return { shouldRelay: false, reason: "relay_disabled" };
  }

  if (message.chat.type !== "supergroup") {
    return { shouldRelay: false, reason: "not_supergroup" };
  }

  if (!config.mainGroupId || message.chat.id !== config.mainGroupId) {
    return { shouldRelay: false, reason: "wrong_chat" };
  }

  if (!config.prayersTopicId) {
    return { shouldRelay: false, reason: "missing_target_topic" };
  }

  if (!isMessageFromBot(message)) {
    return { shouldRelay: false, reason: "not_from_bot" };
  }

  if (!isMessageInGeneralTopic(message, config.prayersTopicId)) {
    return { shouldRelay: false, reason: "not_general_topic" };
  }

  if (!message.text) {
    return { shouldRelay: false, reason: "missing_text" };
  }

  if (!messageMatchesKeywords(message, config.keywords)) {
    return { shouldRelay: false, reason: "keyword_miss" };
  }

  return { shouldRelay: true };
};
