import { executeScheduleBroadcastCommand } from "./scheduleBroadcastCommand";

jest.mock("../services/youtubeBroadcastService", () => ({
  scheduleBroadcastMailing: jest.fn(),
}));

jest.mock("../utils/logger", () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
}));

const { scheduleBroadcastMailing } = jest.requireMock(
  "../services/youtubeBroadcastService"
) as {
  scheduleBroadcastMailing: jest.Mock;
};

describe("scheduleBroadcastCommand", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns usage when no params provided", async () => {
    const result = await executeScheduleBroadcastCommand(1, 2, []);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Использование: /schedule_broadcast");
    expect(scheduleBroadcastMailing).not.toHaveBeenCalled();
  });

  it("returns usage when params are missing", async () => {
    const result = await executeScheduleBroadcastCommand(1, 2, ["abc123XYZ"]);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Использование: /schedule_broadcast");
    expect(scheduleBroadcastMailing).not.toHaveBeenCalled();
  });

  it("returns error for empty title", async () => {
    const result = await executeScheduleBroadcastCommand(1, 2, [
      "abc123XYZ",
      "",
      "2026-07-20T10:00:00Z",
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain("youtubeId, title и scheduledStartTime");
    expect(scheduleBroadcastMailing).not.toHaveBeenCalled();
  });

  it("returns error for invalid date format", async () => {
    const result = await executeScheduleBroadcastCommand(1, 2, [
      "abc123XYZ",
      "Утреннее служение",
      "not-a-date",
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Некорректный формат даты");
    expect(scheduleBroadcastMailing).not.toHaveBeenCalled();
  });

  it("schedules broadcast mailing successfully", async () => {
    scheduleBroadcastMailing.mockResolvedValue({
      id: "mailing-1",
      youtubeId: "abc123XYZ",
      title: "Утреннее служение",
      privacyStatus: "public",
      scheduledStartTime: "2026-07-20T10:00:00Z",
      scheduledFor: "2026-07-20T09:55:00.000Z",
      sentAt: null,
      createdAt: "2026-07-20T09:50:00.000Z",
      updatedAt: "2026-07-20T09:50:00.000Z",
    });

    const result = await executeScheduleBroadcastCommand(1, 2, [
      "abc123XYZ",
      "Утреннее служение",
      "2026-07-20T10:00:00Z",
      "public",
    ]);

    expect(result.success).toBe(true);
    expect(result.message).toContain("Рассылка трансляции запланирована");
    expect(result.message).toContain("abc123XYZ");
    expect(result.message).toContain("Утреннее служение");
    expect(scheduleBroadcastMailing).toHaveBeenCalledWith({
      youtubeId: "abc123XYZ",
      title: "Утреннее служение",
      privacyStatus: "public",
      scheduledStartTime: "2026-07-20T10:00:00Z",
    });
  });

  it("defaults privacy status to public when not provided", async () => {
    scheduleBroadcastMailing.mockResolvedValue({
      id: "mailing-2",
      youtubeId: "abc123XYZ",
      title: "Утреннее служение",
      privacyStatus: "public",
      scheduledStartTime: "2026-07-20T10:00:00Z",
      scheduledFor: "2026-07-20T09:55:00.000Z",
      sentAt: null,
      createdAt: "2026-07-20T09:50:00.000Z",
      updatedAt: "2026-07-20T09:50:00.000Z",
    });

    const result = await executeScheduleBroadcastCommand(1, 2, [
      "abc123XYZ",
      "Утреннее служение",
      "2026-07-20T10:00:00Z",
    ]);

    expect(result.success).toBe(true);
    expect(scheduleBroadcastMailing).toHaveBeenCalledWith({
      youtubeId: "abc123XYZ",
      title: "Утреннее служение",
      privacyStatus: "public",
      scheduledStartTime: "2026-07-20T10:00:00Z",
    });
  });

  it("returns error when scheduling fails", async () => {
    scheduleBroadcastMailing.mockResolvedValue(null);

    const result = await executeScheduleBroadcastCommand(1, 2, [
      "abc123XYZ",
      "Утреннее служение",
      "2026-07-20T10:00:00Z",
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Не удалось запланировать рассылку");
  });
});
