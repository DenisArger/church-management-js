import { executePrayerWeekCommand } from "./prayerWeekCommand";

jest.mock("../services/telegramService", () => ({
  sendMessage: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("../services/notionService", () => ({
  getWeeklyPrayerRecords: jest.fn(),
}));

jest.mock("../utils/logger", () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}));

describe("prayerWeekCommand", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 15, 12, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows prayer records that fall within the next week", async () => {
    const notion = jest.requireMock<typeof import("../services/notionService")>(
      "../services/notionService"
    );
    const sendMessage = jest.requireMock<typeof import("../services/telegramService")>(
      "../services/telegramService"
    ).sendMessage as jest.Mock;

    (notion.getWeeklyPrayerRecords as jest.Mock).mockResolvedValue([
      {
        id: "1",
        person: "Иван Петров",
        topic: "Здоровье",
        note: "",
        dateStart: new Date("2026-05-18"),
        dateEnd: new Date("2026-05-24"),
      },
    ]);

    const result = await executePrayerWeekCommand(10, 20);

    expect(result.success).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith(
      20,
      expect.stringContaining("Иван Петров"),
      { parse_mode: "HTML" }
    );
  });
});
