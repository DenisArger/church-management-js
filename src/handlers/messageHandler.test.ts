import { handleUpdate } from "./messageHandler";

jest.mock("../utils/authHelper", () => ({
  isUserAuthorized: jest.fn(),
  getUnauthorizedMessage: jest.fn(() => "Доступ ограничен"),
  isYouthLeader: jest.fn().mockResolvedValue(false),
}));
jest.mock("../services/telegramService", () => ({
  sendMessage: jest.fn().mockResolvedValue({ success: true }),
  answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
  copyMessageToTopic: jest.fn().mockResolvedValue({
    success: true,
    data: { messageId: 999 },
  }),
  safeRepublishBroadcastMessage: jest.fn().mockResolvedValue({
    success: true,
    data: { messageId: 1001 },
  }),
  deleteTelegramMessage: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock("../commands/helpCommand", () => ({
  executeHelpCommand: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock("../commands/showMenuCommand", () => ({
  executeShowMenuCommand: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock("../utils/logger", () => ({ logInfo: jest.fn(), logWarn: jest.fn() }));
jest.mock("../config/environment", () => ({
  getTelegramConfig: jest.fn(() => ({
    mainGroupId: "-10012345",
    mainGroupPrayersTopicId: "77",
    mainGroupBroadcastTopicId: "1699",
    prayerRelayEnabled: "true",
    prayerRelayKeywords: "молитвенная нужда,помолитесь,молитва,нужда",
    broadcastRewriteEnabled: "true",
  })),
}));
// Minimal mocks for state and other handlers used by handleMessage/handleCallbackQuery
jest.mock("../utils/sundayServiceState", () => ({ hasActiveState: jest.fn().mockResolvedValue(false) }));
jest.mock("../utils/scheduleState", () => ({ hasActiveState: jest.fn().mockResolvedValue(false) }));
jest.mock("../utils/prayerState", () => ({ hasActivePrayerState: jest.fn().mockResolvedValue(false) }));
jest.mock("../utils/youthReportState", () => ({ hasActiveYouthReportState: jest.fn().mockResolvedValue(false) }));
jest.mock("../utils/scriptureScheduleParser", () => ({ isScriptureSchedule: jest.fn().mockReturnValue(false) }));
jest.mock("./scriptureScheduleHandler", () => ({ handleScriptureScheduleMessage: jest.fn() }));
// Commands used from callbacks / switch
jest.mock("../commands/createPollCommand", () => ({ executeCreatePollCommand: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock("../commands/prayerRequestCommand", () => ({
  executePrayerRequestCommand: jest.fn().mockResolvedValue({ success: true }),
  executeAllPrayersCommand: jest.fn().mockResolvedValue({ success: true }),
  executeOldPrayersCommand: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock("../commands/requestStateSundayCommand", () => ({ executeRequestStateSundayCommand: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock("../commands/debugCalendarCommand", () => ({ executeDebugCalendarCommand: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock("../commands/testNotionCommand", () => ({ executeTestNotionCommand: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock("../commands/addPrayerCommand", () => ({
  executeAddPrayerCommand: jest.fn().mockResolvedValue({ success: true }),
  handlePrayerCallback: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock("../commands/weeklyScheduleCommand", () => ({ executeWeeklyScheduleCommand: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock("../commands/prayerWeekCommand", () => ({ executePrayerWeekCommand: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock("../commands/fillSundayServiceCommand", () => ({
  executeFillSundayServiceCommand: jest.fn().mockResolvedValue({ success: true }),
  handleSundayServiceCallback: jest.fn().mockResolvedValue({ success: true }),
  handleSundayServiceTextInput: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock("../commands/editScheduleCommand", () => ({
  executeEditScheduleCommand: jest.fn().mockResolvedValue({ success: true }),
  handleScheduleCallback: jest.fn().mockResolvedValue({ success: true }),
  handleScheduleTextInput: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock("../commands/youthReportCommand", () => ({
  executeYouthReportCommand: jest.fn().mockResolvedValue({ success: true }),
  handleYouthReportCallback: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock("../services/notionService", () => ({ createPrayerNeed: jest.fn().mockResolvedValue({ success: true }) }));

const isUserAuthorized = jest.requireMock<typeof import("../utils/authHelper")>("../utils/authHelper").isUserAuthorized as jest.Mock;
const getUnauthorizedMessage = jest.requireMock<typeof import("../utils/authHelper")>("../utils/authHelper").getUnauthorizedMessage as jest.Mock;
const sendMessage = jest.requireMock<typeof import("../services/telegramService")>("../services/telegramService").sendMessage as jest.Mock;
const copyMessageToTopic = jest.requireMock<typeof import("../services/telegramService")>("../services/telegramService").copyMessageToTopic as jest.Mock;
const safeRepublishBroadcastMessage = jest.requireMock<typeof import("../services/telegramService")>("../services/telegramService").safeRepublishBroadcastMessage as jest.Mock;
const deleteTelegramMessage = jest.requireMock<typeof import("../services/telegramService")>("../services/telegramService").deleteTelegramMessage as jest.Mock;
const executeHelpCommand = jest.requireMock<typeof import("../commands/helpCommand")>("../commands/helpCommand").executeHelpCommand as jest.Mock;
const executeShowMenuCommand = jest.requireMock<typeof import("../commands/showMenuCommand")>("../commands/showMenuCommand").executeShowMenuCommand as jest.Mock;

describe("messageHandler handleUpdate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getUnauthorizedMessage.mockReturnValue("Доступ ограничен");
  });

  it("/help + authorized -> executeHelpCommand", async () => {
    isUserAuthorized.mockReturnValue(true);
    const update = {
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 111, first_name: "U", last_name: "N" },
        chat: { id: 222, type: "private" },
        text: "/help",
        date: 1,
      },
    };
    const r = await handleUpdate(update);
    expect(r.success).toBe(true);
    expect(executeHelpCommand).toHaveBeenCalledWith(111, 222);
  });

  it("/help + not authorized -> sendMessage with refusal", async () => {
    isUserAuthorized.mockReturnValue(false);
    const update = {
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 111, first_name: "U", last_name: "N" },
        chat: { id: 222, type: "private" },
        text: "/help",
        date: 1,
      },
    };
    await handleUpdate(update);
    expect(sendMessage).toHaveBeenCalledWith(222, "Доступ ограничен", expect.any(Object));
    expect(executeHelpCommand).not.toHaveBeenCalled();
  });

  it("callback_query menu:main (authorized) -> executeShowMenuCommand", async () => {
    isUserAuthorized.mockReturnValue(true);
    const update = {
      update_id: 1,
      callback_query: {
        id: "cq1",
        from: { id: 111, first_name: "U" },
        message: { message_id: 1, chat: { id: 222, type: "private" }, from: { id: 1, first_name: "U" }, date: 1 },
        data: "menu:main",
      },
    };
    const r = await handleUpdate(update);
    expect(r.success).toBe(true);
    expect(executeShowMenuCommand).toHaveBeenCalledWith(111, 222);
  });

  it("no message and no callback_query -> error", async () => {
    const r = await handleUpdate({ update_id: 1 });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/No message or callback_query/i);
  });

  it("copies matching bot message from general topic to prayers topic and deletes source", async () => {
    const update = {
      update_id: 1,
      message: {
        message_id: 123,
        from: { id: 999, first_name: "Bot", is_bot: true },
        chat: { id: -10012345, type: "supergroup" },
        text: "Новая молитвенная нужда, помолитесь пожалуйста",
        date: 1,
      },
    };

    const result = await handleUpdate(update);

    expect(result.success).toBe(true);
    expect(copyMessageToTopic).toHaveBeenCalledWith(-10012345, -10012345, 123, 77);
    expect(deleteTelegramMessage).toHaveBeenCalledWith(-10012345, 123);
  });

  it("does not relay bot message without matching keywords", async () => {
    const update = {
      update_id: 1,
      message: {
        message_id: 124,
        from: { id: 999, first_name: "Bot", is_bot: true },
        chat: { id: -10012345, type: "supergroup" },
        text: "Добро пожаловать в группу",
        date: 1,
      },
    };

    await handleUpdate(update);

    expect(copyMessageToTopic).not.toHaveBeenCalled();
    expect(deleteTelegramMessage).not.toHaveBeenCalled();
  });

  it("does not relay messages already in prayers topic", async () => {
    const update = {
      update_id: 1,
      message: {
        message_id: 125,
        from: { id: 999, first_name: "Bot", is_bot: true },
        chat: { id: -10012345, type: "supergroup" },
        text: "Молитвенная нужда",
        date: 1,
        message_thread_id: 77,
        is_topic_message: true,
      },
    };

    await handleUpdate(update);

    expect(copyMessageToTopic).not.toHaveBeenCalled();
    expect(deleteTelegramMessage).not.toHaveBeenCalled();
  });

  it("relays matching bot message from forum general topic thread id 1", async () => {
    const update = {
      update_id: 1,
      message: {
        message_id: 127,
        from: { id: 999, first_name: "Bot", is_bot: true },
        chat: { id: -10012345, type: "supergroup" },
        text: "Просьба: молитва за здоровье",
        date: 1,
        message_thread_id: 1,
        is_topic_message: true,
      },
    };

    await handleUpdate(update);

    expect(copyMessageToTopic).toHaveBeenCalledWith(-10012345, -10012345, 127, 77);
    expect(deleteTelegramMessage).toHaveBeenCalledWith(-10012345, 127);
  });

  it("does not delete source when copy fails", async () => {
    copyMessageToTopic.mockResolvedValueOnce({ success: false, error: "copy failed" });
    const update = {
      update_id: 1,
      message: {
        message_id: 126,
        from: { id: 999, first_name: "Bot", is_bot: true },
        chat: { id: -10012345, type: "supergroup" },
        text: "Молитва о семье",
        date: 1,
      },
    };

    await handleUpdate(update);

    expect(copyMessageToTopic).toHaveBeenCalled();
    expect(deleteTelegramMessage).not.toHaveBeenCalled();
  });

  it("rewrites matching multiline broadcast message and deletes source", async () => {
    const update = {
      update_id: 1,
      message: {
        message_id: 200,
        from: { id: 999, first_name: "Bot", is_bot: true },
        chat: { id: -10012345, type: "supergroup" },
        text: "Прямая трансляция\n\nНаступил этот день воскресенья!\nПредавай все дела забвенью!\nПодключись, чтобы услышать слово!\n\nТрансляция в 10:00",
        date: 1,
        message_thread_id: 1699,
        is_topic_message: true,
      },
    };

    await handleUpdate(update);

    expect(safeRepublishBroadcastMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message_id: 200 }),
      expect.any(String)
    );
    expect(deleteTelegramMessage).toHaveBeenCalledWith(-10012345, 200);
  });

  it("rewrites matching single-line broadcast message and deletes source", async () => {
    const update = {
      update_id: 1,
      message: {
        message_id: 201,
        from: { id: 999, first_name: "Bot", is_bot: true },
        chat: { id: -10012345, type: "supergroup" },
        text: "Наступил этот день воскресенья! Предавай все дела забвенью! Подключись, чтобы услышать слово!",
        date: 1,
        message_thread_id: 1699,
        is_topic_message: true,
      },
    };

    await handleUpdate(update);

    expect(safeRepublishBroadcastMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message_id: 201 }),
      expect.any(String)
    );
    expect(deleteTelegramMessage).toHaveBeenCalledWith(-10012345, 201);
  });

  it("does not rewrite non-matching broadcast message", async () => {
    const update = {
      update_id: 1,
      message: {
        message_id: 202,
        from: { id: 999, first_name: "Bot", is_bot: true },
        chat: { id: -10012345, type: "supergroup" },
        text: "Совсем другой анонс трансляции",
        date: 1,
        message_thread_id: 1699,
        is_topic_message: true,
      },
    };

    await handleUpdate(update);

    expect(safeRepublishBroadcastMessage).not.toHaveBeenCalled();
  });

  it("does not delete source when broadcast republish fails", async () => {
    safeRepublishBroadcastMessage.mockResolvedValueOnce({
      success: false,
      error: "republish failed",
    });
    const update = {
      update_id: 1,
      message: {
        message_id: 203,
        from: { id: 999, first_name: "Bot", is_bot: true },
        chat: { id: -10012345, type: "supergroup" },
        text: "Наступил этот день воскресенья! Предавай все дела забвенью! Подключись, чтобы услышать слово!",
        date: 1,
        message_thread_id: 1699,
        is_topic_message: true,
      },
    };

    await handleUpdate(update);

    expect(safeRepublishBroadcastMessage).toHaveBeenCalled();
    expect(deleteTelegramMessage).not.toHaveBeenCalledWith(-10012345, 203);
  });
});
