import { executeTestNotionCommand } from "./testNotionCommand";

jest.mock("../services/telegramService", () => ({
  sendMessage: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock("../services/notionService", () => ({
  getNotionClient: jest.fn(),
  getActivePrayerNeeds: jest.fn().mockResolvedValue([]),
  getDailyScripture: jest.fn().mockResolvedValue(null),
  getWeeklyPrayerRecords: jest.fn().mockResolvedValue([]),
}));
jest.mock("../utils/logger", () => ({ logInfo: jest.fn(), logError: jest.fn() }));

// Dynamic import in testNotion uses "../services/notionService" and getWeeklyPrayerRecords
// Our mock already provides getWeeklyPrayerRecords

describe("testNotionCommand", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const notion = jest.requireMock<typeof import("../services/notionService")>("../services/notionService");
    (notion.getNotionClient as jest.Mock).mockReturnValue({});
    (notion.getActivePrayerNeeds as jest.Mock).mockResolvedValue([]);
    (notion.getDailyScripture as jest.Mock).mockResolvedValue(null);
    (notion.getWeeklyPrayerRecords as jest.Mock).mockResolvedValue([]);
  });

  it("sends HTML message with test results when Notion calls succeed", async () => {
    const sendMessage = jest.requireMock<typeof import("../services/telegramService")>("../services/telegramService").sendMessage;
    const r = await executeTestNotionCommand(111, 222);
    expect(r.success).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith(222, expect.stringMatching(/Notion|тест|Результат/i), { parse_mode: "HTML" });
  });
});
