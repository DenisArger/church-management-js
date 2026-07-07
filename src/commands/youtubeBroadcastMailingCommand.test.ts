import { runBroadcastMailing } from "./youtubeBroadcastMailingCommand";

jest.mock("../services/telegramService", () => ({
  sendMessage: jest.fn().mockResolvedValue({ success: true, data: { messageId: 101 } }),
  sendPhotoWithOptions: jest.fn().mockResolvedValue({ success: true, data: { messageId: 102 } }),
  deleteTelegramMessage: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("../services/youtubeBroadcastService", () => ({
  schedulePostDeletion: jest.fn().mockResolvedValue({ id: "del-1" }),
}));

jest.mock("../config/environment", () => ({
  getAppConfig: () => ({ debug: false }),
  getTelegramConfig: () => ({
    technoGroupId: "-100200",
    technoGroupBroadcastTopicId: "50",
    mainGroupId: "-100300",
    mainGroupBroadcastTopicId: "60",
    mainChannelId: "-100400",
  }),
}));

jest.mock("../utils/logger", () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
}));

jest.mock("../utils/youtubeBroadcastWording", () => ({
  ...jest.requireActual("../utils/youtubeBroadcastWording"),
  composeYouTubeBroadcastCaption: jest.fn().mockReturnValue("Наступил этот день воскресенья\\!\nПредавай все дела забвенью\\!\nПодключись, чтобы услышать слово\\!\n\n[Трансляция в 10:00](https://youtu.be/abc123XYZ)"),
  getBroadcastPhotoId: jest.fn().mockReturnValue("photo-id"),
  buildWatchButton: jest.fn().mockReturnValue({ inline_keyboard: [] }),
}));

describe("youtubeBroadcastMailingCommand", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends message to techno group for public broadcast", async () => {
    const sendMessage = jest.requireMock<typeof import("../services/telegramService")>(
      "../services/telegramService"
    ).sendMessage as jest.Mock;

    const result = await runBroadcastMailing(
      "abc123XYZ",
      "Утреннее служение",
      "public",
      "2026-07-12T07:00:00Z"
    );

    expect(result.success).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith(
      -100200,
      "Наступил этот день воскресенья\\!\nПредавай все дела забвенью\\!\nПодключись, чтобы услышать слово\\!\n\n[Трансляция в 10:00](https://youtu.be/abc123XYZ)",
      expect.objectContaining({
        parse_mode: "MarkdownV2",
        message_thread_id: 50,
        reply_markup: expect.objectContaining({
          inline_keyboard: expect.any(Array),
        }),
      })
    );
  });

  it("sends photos to main group and channel for public broadcast", async () => {
    const sendPhotoWithOptions = jest.requireMock<typeof import("../services/telegramService")>(
      "../services/telegramService"
    ).sendPhotoWithOptions as jest.Mock;

    await runBroadcastMailing(
      "abc123XYZ",
      "Утреннее служение",
      "public",
      "2026-07-12T07:00:00Z"
    );

    expect(sendPhotoWithOptions).toHaveBeenCalledTimes(2);
    expect(sendPhotoWithOptions).toHaveBeenNthCalledWith(
      1,
      -100300,
      "photo-id",
      expect.objectContaining({
        caption: "Наступил этот день воскресенья\\!\nПредавай все дела забвенью\\!\nПодключись, чтобы услышать слово\\!\n\n[Трансляция в 10:00](https://youtu.be/abc123XYZ)",
        parse_mode: "MarkdownV2",
        message_thread_id: 60,
      })
    );
    expect(sendPhotoWithOptions).toHaveBeenNthCalledWith(
      2,
      -100400,
      "photo-id",
      expect.objectContaining({
        caption: "Наступил этот день воскресенья\\!\nПредавай все дела забвенью\\!\nПодключись, чтобы услышать слово\\!\n\n[Трансляция в 10:00](https://youtu.be/abc123XYZ)",
        parse_mode: "MarkdownV2",
      })
    );
  });

  it("schedules post deletion for main channel photo", async () => {
    const schedulePostDeletion = jest.requireMock<typeof import("../services/youtubeBroadcastService")>(
      "../services/youtubeBroadcastService"
    ).schedulePostDeletion as jest.Mock;

    await runBroadcastMailing(
      "abc123XYZ",
      "Утреннее служение",
      "public",
      "2026-07-12T07:00:00Z"
    );

    expect(schedulePostDeletion).toHaveBeenCalledWith(-100400, 102, 11);
  });

  it("skips main group and channel for private broadcast", async () => {
    const sendPhotoWithOptions = jest.requireMock<typeof import("../services/telegramService")>(
      "../services/telegramService"
    ).sendPhotoWithOptions as jest.Mock;

    const result = await runBroadcastMailing(
      "abc123XYZ",
      "Утреннее служение",
      "private",
      "2026-07-12T07:00:00Z"
    );

    expect(result.success).toBe(true);
    expect(sendPhotoWithOptions).not.toHaveBeenCalled();
  });
});
