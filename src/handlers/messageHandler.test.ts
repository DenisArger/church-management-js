import { handleUpdate } from "./messageHandler";

jest.mock("../utils/authHelper", () => ({
  isUserAuthorized: jest.fn(),
  getUnauthorizedMessage: jest.fn(() => "Доступ ограничен"),
  isYouthLeader: jest.fn().mockResolvedValue(false),
}));
jest.mock("../services/telegramService", () => ({
  sendMessage: jest.fn().mockResolvedValue({ success: true }),
  answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../commands/helpCommand", () => ({
  executeHelpCommand: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock("../commands/showMenuCommand", () => ({
  executeShowMenuCommand: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock("../utils/logger", () => ({ logInfo: jest.fn(), logWarn: jest.fn() }));
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
});
