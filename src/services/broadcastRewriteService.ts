import { TelegramMessage } from "../types";

type BroadcastRewriteConfig = {
  enabled: boolean;
  mainGroupId: number | null;
  broadcastTopicId: number | null;
};

const ORIGINAL_BROADCAST_BLOCK_MULTILINE =
  "Наступил этот день воскресенья!\nПредавай все дела забвенью!\nПодключись, чтобы услышать слово!";
const ORIGINAL_BROADCAST_BLOCK_SINGLELINE =
  "Наступил этот день воскресенья! Предавай все дела забвенью! Подключись, чтобы услышать слово!";

const BROADCAST_TEMPLATES = [
  ORIGINAL_BROADCAST_BLOCK_MULTILINE,
  "Этот день нам Бог подарил,\nЧтобы каждый Его прославил!\nПодключайся услышать Слово —\nВоскресенье встречаем снова.",
  "Наш Бог велик — и это правда!\nПусть звучит хвала сегодня славно.\nПодключайся, не пропусти —\nСлово жизни впереди.",
  "Душа, Господа прославляй,\nВ это утро к Нему взывай.\nПодключайся услышать Слово —\nБог сегодня говорит нам снова.",
  "Искупитель наш жив и силён,\nНад землёю царствует Он.\nПодключайся — будем вместе\nСлушать Слово в этом месте.",
  "Велик Господь — хвала Ему!\nСердце откроем мы Слову Его.\nПрисоединяйся в этот час —\nБог желает говорить для нас.",
  "Сердце Богу открывай,\nЕго голос принимай.\nПодключайся к трансляции снова —\nБудем слушать Божье Слово.",
  "Аллилуйя! Бог царствует!\nПусть хвала сегодня торжествует.\nПодключайся — будем вместе\nСлавить Бога в этом месте.",
  "Бог достоин всей хвалы,\nВсе народы и все мы.\nПодключайся — вместе снова\nБудем слушать Божье Слово.",
  "Свят Господь — поет земля,\nЕму хвала во все века!\nПодключайся в этот час —\nСлово Божье ждёт всех нас.",
  "Будем Бога прославлять,\nЕго Слово принимать.\nПодключайся, не зевай —\nВоскресенье начинай!",
  "Бог благой во все века,\nЕго милость велика!\nПодключайся к нам сейчас —\nСлово будет и для нас.",
  "Славьте Господа, друзья!\nОн надежда и скала.\nПодключайся к нам с любовью —\nБудем слушать Божье Слово.",
];

const parseId = (value?: string | null): number | null => {
  if (!value) {
    return null;
  }

  const parsed = parseInt(value.trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const getMessageBody = (message: TelegramMessage): string =>
  message.text ?? message.caption ?? "";

const isMessageFromBot = (message: TelegramMessage): boolean =>
  message.from?.is_bot === true;

export const getBroadcastRewriteConfig = (
  telegramConfig: Record<string, unknown>
): BroadcastRewriteConfig => {
  const enabledValue = String(
    telegramConfig.broadcastRewriteEnabled ?? ""
  ).trim().toLowerCase();
  const enabled =
    enabledValue === "true" || enabledValue === "1" || enabledValue === "yes";

  return {
    enabled,
    mainGroupId: parseId(telegramConfig.mainGroupId as string | undefined),
    broadcastTopicId: parseId(
      telegramConfig.mainGroupBroadcastTopicId as string | undefined
    ),
  };
};

const findOriginalBroadcastBlock = (body: string): string | null => {
  if (body.includes(ORIGINAL_BROADCAST_BLOCK_MULTILINE)) {
    return ORIGINAL_BROADCAST_BLOCK_MULTILINE;
  }

  if (body.includes(ORIGINAL_BROADCAST_BLOCK_SINGLELINE)) {
    return ORIGINAL_BROADCAST_BLOCK_SINGLELINE;
  }

  return null;
};

export const shouldRewriteBroadcastMessage = (
  message: TelegramMessage,
  config: BroadcastRewriteConfig
): { shouldRewrite: boolean; reason?: string } => {
  if (!config.enabled) {
    return { shouldRewrite: false, reason: "rewrite_disabled" };
  }

  if (message.chat.type !== "supergroup") {
    return { shouldRewrite: false, reason: "not_supergroup" };
  }

  if (!config.mainGroupId || message.chat.id !== config.mainGroupId) {
    return { shouldRewrite: false, reason: "wrong_chat" };
  }

  if (!config.broadcastTopicId) {
    return { shouldRewrite: false, reason: "missing_broadcast_topic" };
  }

  if (message.message_thread_id !== config.broadcastTopicId) {
    return { shouldRewrite: false, reason: "wrong_topic" };
  }

  if (!isMessageFromBot(message)) {
    return { shouldRewrite: false, reason: "not_from_bot" };
  }

  if (!findOriginalBroadcastBlock(getMessageBody(message))) {
    return { shouldRewrite: false, reason: "template_miss" };
  }

  return { shouldRewrite: true };
};

export const buildRewrittenBroadcastMessage = (
  message: TelegramMessage
): { rewrittenText: string; templateIndex: number } | null => {
  const body = getMessageBody(message);
  const matchedBlock = findOriginalBroadcastBlock(body);

  if (!matchedBlock) {
    return null;
  }

  const templateIndex = Math.floor(Math.random() * BROADCAST_TEMPLATES.length);
  return {
    rewrittenText: body.replace(
      matchedBlock,
      BROADCAST_TEMPLATES[templateIndex]
    ),
    templateIndex,
  };
};
