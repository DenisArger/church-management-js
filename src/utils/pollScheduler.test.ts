import {
  calculatePollSendTime,
  shouldSendPoll,
  shouldSendNotification,
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
    it("returns true within 2 min after send time", () => {
      const event = new Date(2025, 0, 20, 19, 0, 0, 0);
      const sendTime = new Date(2025, 0, 19, 19, 0, 0, 0);
      const now = new Date(sendTime.getTime() + 60 * 1000);
      expect(shouldSendPoll(event, now)).toBe(true);
    });
    it("returns false after 2 min past send time", () => {
      const event = new Date(2025, 0, 20, 19, 0, 0, 0);
      const sendTime = new Date(2025, 0, 19, 19, 0, 0, 0);
      const now = new Date(sendTime.getTime() + 3 * 60 * 1000);
      expect(shouldSendPoll(event, now)).toBe(false);
    });
  });

  describe("shouldSendNotification", () => {
    it("returns true within 10 min after 3h before event", () => {
      const event = new Date(2025, 0, 20, 19, 0, 0, 0);
      const threeHBefore = new Date(2025, 0, 20, 16, 0, 0, 0);
      const now = new Date(threeHBefore.getTime() + 5 * 60 * 1000);
      expect(shouldSendNotification(event, now)).toBe(true);
    });
    it("returns false before 3h before event", () => {
      const event = new Date(2025, 0, 20, 19, 0, 0, 0);
      const now = new Date(2025, 0, 20, 15, 0, 0, 0);
      expect(shouldSendNotification(event, now)).toBe(false);
    });
    it("returns false after 10 min past 3h before", () => {
      const event = new Date(2025, 0, 20, 19, 0, 0, 0);
      const threeHBefore = new Date(2025, 0, 20, 16, 0, 0, 0);
      const now = new Date(threeHBefore.getTime() + 15 * 60 * 1000);
      expect(shouldSendNotification(event, now)).toBe(false);
    });
  });

  describe("hasTheme", () => {
    it("returns true when theme is non-empty", () => {
      expect(hasTheme({ theme: "Тема" })).toBe(true);
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
