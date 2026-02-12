import {
  calculatePollSendTime,
  shouldSendPoll,
  shouldSendNotification,
  shouldSendYouthReportReminder,
  shouldSendYouthCareReminder,
  hasTheme,
  isEventMissing,
  hasTime,
} from "./pollScheduler";

jest.mock("./logger", () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}));

describe("pollScheduler", () => {
  describe("calculatePollSendTime", () => {
    it("returns exactly 24h before event at same time", () => {
      const event = new Date(2025, 0, 20, 19, 0, 0, 0);
      const send = calculatePollSendTime(event);
      expect(send.getTime()).toBe(event.getTime() - 24 * 60 * 60 * 1000);
    });
  });

  describe("shouldSendPoll", () => {
    it("returns false when event has passed", () => {
      const event = new Date(2020, 0, 1, 19, 0);
      const now = new Date(2025, 0, 1);
      expect(shouldSendPoll(event, now)).toBe(false);
    });
    it("returns false before the 24h window", () => {
      const event = new Date(2025, 0, 20, 19, 0, 0, 0);
      const now = new Date(2025, 0, 19, 18, 0, 0, 0); // 25h before
      expect(shouldSendPoll(event, now)).toBe(false);
    });
    it("returns true within 15 min after send time", () => {
      const event = new Date(2025, 0, 20, 19, 0, 0, 0);
      const sendTime = new Date(2025, 0, 19, 19, 0, 0, 0);
      const now = new Date(sendTime.getTime() + 10 * 60 * 1000);
      expect(shouldSendPoll(event, now)).toBe(true);
    });
    it("returns false after 15 min past send time", () => {
      const event = new Date(2025, 0, 20, 19, 0, 0, 0);
      const sendTime = new Date(2025, 0, 19, 19, 0, 0, 0);
      const now = new Date(sendTime.getTime() + 16 * 60 * 1000);
      expect(shouldSendPoll(event, now)).toBe(false);
    });
  });

  describe("shouldSendNotification", () => {
    it("returns true within 15 min after notification time", () => {
      // Notification time is 27h before event (3h before poll send)
      // Event at 19:00 Moscow -> 16:00 UTC
      const event = new Date(Date.UTC(2025, 0, 20, 16, 0, 0, 0));
      const notifyTime = new Date(Date.UTC(2025, 0, 19, 13, 0, 0, 0));
      const now = new Date(notifyTime.getTime() + 10 * 60 * 1000);
      expect(shouldSendNotification(event, now)).toBe(true);
    });
    it("returns true within 15 min before notification time", () => {
      const event = new Date(Date.UTC(2025, 0, 20, 16, 0, 0, 0));
      const notifyTime = new Date(Date.UTC(2025, 0, 19, 13, 0, 0, 0));
      const now = new Date(notifyTime.getTime() - 10 * 60 * 1000);
      expect(shouldSendNotification(event, now)).toBe(true);
    });
    it("returns false after 15 min past notification time", () => {
      const event = new Date(Date.UTC(2025, 0, 20, 16, 0, 0, 0));
      const notifyTime = new Date(Date.UTC(2025, 0, 19, 13, 0, 0, 0));
      const now = new Date(notifyTime.getTime() + 16 * 60 * 1000);
      expect(shouldSendNotification(event, now)).toBe(false);
    });
    it("returns false more than 15 min before notification time", () => {
      const event = new Date(Date.UTC(2025, 0, 20, 16, 0, 0, 0));
      const notifyTime = new Date(Date.UTC(2025, 0, 19, 13, 0, 0, 0));
      const now = new Date(notifyTime.getTime() - 16 * 60 * 1000);
      expect(shouldSendNotification(event, now)).toBe(false);
    });
  });

  describe("shouldSendYouthReportReminder", () => {
    it("returns true on last day at 11:00 Moscow within 15 minutes", () => {
      // Moscow is UTC+3, so 11:05 Moscow = 08:05 UTC
      const now = new Date(Date.UTC(2025, 0, 31, 8, 5, 0, 0));
      expect(shouldSendYouthReportReminder(now)).toBe(true);
    });
    it("returns false on non-last day", () => {
      const now = new Date(Date.UTC(2025, 0, 30, 8, 5, 0, 0));
      expect(shouldSendYouthReportReminder(now)).toBe(false);
    });
    it("returns false outside the 15-minute window", () => {
      // 11:20 Moscow = 08:20 UTC
      const now = new Date(Date.UTC(2025, 0, 31, 8, 20, 0, 0));
      expect(shouldSendYouthReportReminder(now)).toBe(false);
    });
  });

  describe("shouldSendYouthCareReminder", () => {
    it("returns true on 12th at 17:30 Moscow within 15 minutes", () => {
      // Moscow is UTC+3, so 17:35 Moscow = 14:35 UTC
      const now = new Date(Date.UTC(2025, 0, 12, 14, 35, 0, 0));
      expect(shouldSendYouthCareReminder(now)).toBe(true);
    });
    it("returns true on 20th at 17:30 Moscow within 15 minutes", () => {
      const now = new Date(Date.UTC(2025, 0, 20, 14, 40, 0, 0));
      expect(shouldSendYouthCareReminder(now)).toBe(true);
    });
    it("returns false on other days", () => {
      const now = new Date(Date.UTC(2025, 0, 11, 14, 35, 0, 0));
      expect(shouldSendYouthCareReminder(now)).toBe(false);
    });
    it("returns false outside the 15-minute window", () => {
      // 17:50 Moscow = 14:50 UTC
      const now = new Date(Date.UTC(2025, 0, 12, 14, 50, 0, 0));
      expect(shouldSendYouthCareReminder(now)).toBe(false);
    });
  });

  describe("hasTheme", () => {
    it("returns true when theme is non-empty", () => {
      expect(hasTheme({ theme: "Тема" })).toBe(true);
    });
    it("returns true when title is non-empty", () => {
      expect(hasTheme({ title: "Название" })).toBe(true);
    });
    it("returns false when theme is empty or null", () => {
      expect(hasTheme({ theme: "" })).toBe(false);
      expect(hasTheme({ theme: "  " })).toBe(false);
      expect(hasTheme(null)).toBe(false);
    });
  });

  describe("isEventMissing", () => {
    it("returns true for null", () => expect(isEventMissing(null)).toBe(true));
    it("returns false for object", () =>
      expect(isEventMissing({ date: new Date() })).toBe(false));
  });

  describe("hasTime", () => {
    it("returns false for null", () => expect(hasTime(null)).toBe(false));
    it("returns false for date-only (00:00:00.000 UTC)", () => {
      const d = new Date(Date.UTC(2025, 0, 15, 0, 0, 0, 0));
      expect(hasTime({ date: d })).toBe(false);
    });
    it("returns true when time is set", () => {
      const d = new Date(Date.UTC(2025, 0, 15, 19, 30, 0, 0));
      expect(hasTime({ date: d })).toBe(true);
    });
  });
});
