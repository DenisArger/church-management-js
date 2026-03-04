import { sendYouthReportReminderToAdmins } from "./youthReportReminderCommand";

jest.mock("../config/environment", () => ({
  getAppConfig: jest.fn(() => ({ debug: false })),
}));

jest.mock("../services/telegramService", () => ({
  getTelegramConfigForMode: jest.fn(() => ({ chatId: 999, bot: {} })),
  sendMessageToUser: jest.fn().mockResolvedValue({ success: true }),
  sendMessageWithBot: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("../services/notionService", () => ({
  getYouthLeadersMapping: jest.fn(),
  hasYouthReportForLeaderInMonth: jest.fn(),
}));

jest.mock("../utils/youthReportReminderGenerator", () => ({
  getRandomYouthReportReminder: jest.fn(() => "reminder text"),
}));

jest.mock("../utils/logger", () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
}));

const sendMessageToUser = jest.requireMock<
  typeof import("../services/telegramService")
>("../services/telegramService").sendMessageToUser as jest.Mock;

const getYouthLeadersMapping = jest.requireMock<
  typeof import("../services/notionService")
>("../services/notionService").getYouthLeadersMapping as jest.Mock;

const hasYouthReportForLeaderInMonth = jest.requireMock<
  typeof import("../services/notionService")
>("../services/notionService").hasYouthReportForLeaderInMonth as jest.Mock;

describe("sendYouthReportReminderToAdmins", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sendOnlyMissing: skips leader when report exists", async () => {
    getYouthLeadersMapping.mockResolvedValue(
      new Map<number, string>([[111, "Leader A"]])
    );
    hasYouthReportForLeaderInMonth.mockResolvedValue(true);

    const result = await sendYouthReportReminderToAdmins({
      mode: "sendOnlyMissing",
      targetMonth: { year: 2026, month: 3 },
    });

    expect(result.success).toBe(true);
    expect(sendMessageToUser).not.toHaveBeenCalled();
    expect(result.message).toBe("No follow-up reminders needed");
  });

  it("sendOnlyMissing: sends reminder when report is missing", async () => {
    getYouthLeadersMapping.mockResolvedValue(
      new Map<number, string>([[222, "Leader B"]])
    );
    hasYouthReportForLeaderInMonth.mockResolvedValue(false);

    const result = await sendYouthReportReminderToAdmins({
      mode: "sendOnlyMissing",
      targetMonth: { year: 2026, month: 3 },
    });

    expect(result.success).toBe(true);
    expect(sendMessageToUser).toHaveBeenCalledTimes(1);
    expect(sendMessageToUser).toHaveBeenCalledWith(
      222,
      "reminder text",
      expect.objectContaining({ parse_mode: "HTML" })
    );
  });

  it("sendOnlyMissing: sends only subset for mixed leaders", async () => {
    getYouthLeadersMapping.mockResolvedValue(
      new Map<number, string>([
        [333, "Leader C"],
        [444, "Leader D"],
      ])
    );
    hasYouthReportForLeaderInMonth.mockImplementation(async (name: string) => {
      return name === "Leader C";
    });

    const result = await sendYouthReportReminderToAdmins({
      mode: "sendOnlyMissing",
      targetMonth: { year: 2026, month: 3 },
    });

    expect(result.success).toBe(true);
    expect(sendMessageToUser).toHaveBeenCalledTimes(1);
    expect(sendMessageToUser).toHaveBeenCalledWith(
      444,
      "reminder text",
      expect.any(Object)
    );
  });

  it("sendOnlyMissing: returns error when targetMonth is not provided", async () => {
    getYouthLeadersMapping.mockResolvedValue(
      new Map<number, string>([[555, "Leader E"]])
    );

    const result = await sendYouthReportReminderToAdmins({
      mode: "sendOnlyMissing",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/targetMonth is required/i);
    expect(sendMessageToUser).not.toHaveBeenCalled();
  });

  it("sendOnlyMissing: returns error when Notion check throws", async () => {
    getYouthLeadersMapping.mockResolvedValue(
      new Map<number, string>([[666, "Leader F"]])
    );
    hasYouthReportForLeaderInMonth.mockRejectedValue(new Error("Notion down"));

    const result = await sendYouthReportReminderToAdmins({
      mode: "sendOnlyMissing",
      targetMonth: { year: 2026, month: 3 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Notion down/i);
    expect(sendMessageToUser).not.toHaveBeenCalled();
  });
});
