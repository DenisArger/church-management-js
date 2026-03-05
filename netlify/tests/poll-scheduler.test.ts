import { handler } from "../functions/poll-scheduler";

jest.mock("../../src/config/appConfigStore", () => ({
  ensureAppConfigLoaded: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/commands/autoPollCommand", () => ({
  executeAutoPollForEvent: jest.fn().mockResolvedValue({ success: true }),
  sendPollNotification: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("../../src/commands/weeklyScheduleCommand", () => ({
  sendAdminWeeklySchedule: jest.fn().mockResolvedValue({ success: true }),
  sendWeeklyScheduleToChat: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("../../src/commands/youthCareReminderCommand", () => ({
  sendYouthCareReminderToAdmins: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("../../src/commands/youthReportReminderCommand", () => ({
  sendYouthReportReminderToAdmins: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("../../src/config/environment", () => ({
  getTelegramConfig: jest.fn(() => ({
    mainGroupId: "",
    announcementsTopicId: "",
  })),
}));

jest.mock("../../src/services/notionService", () => ({
  getYouthEventsForDateRange: jest.fn().mockResolvedValue([]),
}));

jest.mock("../../src/utils/logger", () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
}));

const sendYouthReportReminderToAdmins = jest.requireMock<
  typeof import("../../src/commands/youthReportReminderCommand")
>("../../src/commands/youthReportReminderCommand")
  .sendYouthReportReminderToAdmins as jest.Mock;

describe("poll-scheduler youth report reminders", () => {
  const originalNow = process.env.SCHEDULER_NOW_ISO;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SCHEDULER_FORCE_DEBUG;
  });

  afterAll(() => {
    if (originalNow === undefined) {
      delete process.env.SCHEDULER_NOW_ISO;
    } else {
      process.env.SCHEDULER_NOW_ISO = originalNow;
    }
  });

  it("triggers follow-up reminder on 2026-04-01 12:25 Moscow for March 2026", async () => {
    process.env.SCHEDULER_NOW_ISO = "2026-04-01T09:25:00.000Z";

    await handler(
      {
        httpMethod: "GET",
        headers: {},
      } as any,
      {} as any
    );

    expect(sendYouthReportReminderToAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "sendOnlyMissing",
        targetMonth: { year: 2026, month: 3 },
      })
    );
  });

  it("triggers follow-up reminder on 2026-04-03 and 2026-04-05 for March 2026", async () => {
    process.env.SCHEDULER_NOW_ISO = "2026-04-03T09:25:00.000Z";
    await handler({ httpMethod: "GET", headers: {} } as any, {} as any);

    process.env.SCHEDULER_NOW_ISO = "2026-04-05T09:25:00.000Z";
    await handler({ httpMethod: "GET", headers: {} } as any, {} as any);

    expect(sendYouthReportReminderToAdmins).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        mode: "sendOnlyMissing",
        targetMonth: { year: 2026, month: 3 },
      })
    );
    expect(sendYouthReportReminderToAdmins).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        mode: "sendOnlyMissing",
        targetMonth: { year: 2026, month: 3 },
      })
    );
  });

  it("keeps primary reminder on last day of month", async () => {
    process.env.SCHEDULER_NOW_ISO = "2026-03-31T08:05:00.000Z";

    await handler(
      {
        httpMethod: "GET",
        headers: {},
      } as any,
      {} as any
    );

    expect(sendYouthReportReminderToAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "sendToAll",
      })
    );
  });
});
