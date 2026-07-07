import { sendDailyScripture, formatDailyScriptureMessage } from "./dailyScriptureCommand";

jest.mock("../config/environment", () => ({
  getAppConfig: jest.fn(() => ({ debug: false })),
  getTelegramConfig: jest.fn(() => ({
    mainGroupId: "100",
    readBibleTopicId: "200",
    allowedUsers: [],
  })),
}));

jest.mock("../services/telegramService", () => ({
  getTelegramConfigForMode: jest.fn(() => ({ chatId: 999, bot: {}, topicId: undefined })),
  sendMessage: jest.fn().mockResolvedValue({ success: true }),
  sendMessageWithBot: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("../services/notionService", () => ({
  getDailyScripture: jest.fn(),
}));

jest.mock("../utils/logger", () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
}));

const sendMessage = jest.requireMock<
  typeof import("../services/telegramService")
>("../services/telegramService").sendMessage as jest.Mock;

const getDailyScripture = jest.requireMock<
  typeof import("../services/notionService")
>("../services/notionService").getDailyScripture as jest.Mock;

const sampleScripture = {
  id: "page-1",
  date: new Date(),
  dayNumber: 187,
  oldTestament: "Бытие 1-3",
  newTestament: "Матфея 5-7",
};

describe("sendDailyScripture", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("skips broadcast when no scripture for today", async () => {
    getDailyScripture.mockResolvedValue(null);
    const result = await sendDailyScripture();
    expect(result.success).toBe(true);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends scripture to main group with read-bible topic (HTML)", async () => {
    getDailyScripture.mockResolvedValue(sampleScripture);
    const result = await sendDailyScripture();
    expect(result.success).toBe(true);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    const [chatId, text, options] = sendMessage.mock.calls[0];
    expect(chatId).toBe(100);
    expect(options).toMatchObject({
      parse_mode: "HTML",
      message_thread_id: 200,
    });
    expect(text).toContain("187");
    expect(text).toContain("Бытие 1-3");
    expect(text).toContain("Матфея 5-7");
    expect(text).toContain("Ветхий Завет:");
    expect(text).toContain("Новый Завет:");
  });

  it("uses 'нет данных' fallback for missing fields", async () => {
    getDailyScripture.mockResolvedValue({
      ...sampleScripture,
      dayNumber: null,
      oldTestament: "",
      newTestament: "",
    });
    const result = await sendDailyScripture();
    expect(result.success).toBe(true);
    const [, text] = sendMessage.mock.calls[0];
    expect(text).toContain("нет данных");
  });

  it("fails when main group ID is not configured", async () => {
    const getTelegramConfig = jest.requireMock<
      typeof import("../config/environment")
    >("../config/environment").getTelegramConfig as jest.Mock;
    getTelegramConfig.mockReturnValueOnce({
      mainGroupId: "",
      readBibleTopicId: "200",
      allowedUsers: [],
    });
    getDailyScripture.mockResolvedValue(sampleScripture);
    const result = await sendDailyScripture();
    expect(result.success).toBe(false);
    expect(result.error).toContain("Main group ID not configured");
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe("formatDailyScriptureMessage", () => {
  it("produces the same text for the same date (stable in scheduler window)", () => {
    const d = new Date("2026-07-07T09:30:00+03:00");
    const a = formatDailyScriptureMessage(sampleScripture, d);
    const b = formatDailyScriptureMessage(sampleScripture, d);
    expect(a).toBe(b);
  });

});
