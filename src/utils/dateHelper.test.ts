import {
  formatDate,
  formatDateShort,
  formatTime,
  addDays,
  isToday,
  isThisWeek,
  formatDateForNotion,
} from "./dateHelper";

describe("dateHelper", () => {
  describe("formatDate", () => {
    it("formats date with weekday in Russian", () => {
      const d = new Date(2025, 0, 15); // 15 Jan 2025, Wednesday
      expect(formatDate(d)).toMatch(/\d/);
      expect(formatDate(d)).toContain("2025");
      expect(formatDate(d)).toMatch(/январ|15|15/);
    });
  });

  describe("formatDateShort", () => {
    it("formats date without weekday", () => {
      const d = new Date(2025, 5, 10);
      expect(formatDateShort(d)).toMatch(/\d/);
      expect(formatDateShort(d)).toContain("2025");
    });
  });

  describe("formatTime", () => {
    it("formats time as HH:MM", () => {
      const d = new Date(2025, 0, 1, 14, 30);
      expect(formatTime(d)).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe("addDays", () => {
    it("adds positive days", () => {
      const d = new Date(2025, 0, 10);
      const r = addDays(d, 5);
      expect(r.getDate()).toBe(15);
    });
    it("subtracts when negative", () => {
      const d = new Date(2025, 0, 10);
      const r = addDays(d, -3);
      expect(r.getDate()).toBe(7);
    });
  });

  describe("isToday", () => {
    it("returns true for today", () => {
      const today = new Date();
      expect(isToday(today)).toBe(true);
    });
    it("returns false for yesterday", () => {
      const yesterday = addDays(new Date(), -1);
      expect(isToday(yesterday)).toBe(false);
    });
  });

  describe("isThisWeek", () => {
    it("returns true for a date within current week", () => {
      const today = new Date();
      expect(isThisWeek(today)).toBe(true);
    });
    it("returns false for a date next week", () => {
      const nextWeek = addDays(new Date(), 8);
      expect(isThisWeek(nextWeek)).toBe(false);
    });
  });

  describe("formatDateForNotion", () => {
    it("returns YYYY-MM-DD", () => {
      const d = new Date(2025, 0, 5);
      expect(formatDateForNotion(d)).toBe("2025-01-05");
    });
    it("pads month and day", () => {
      const d = new Date(2025, 8, 9);
      expect(formatDateForNotion(d)).toBe("2025-09-09");
    });
  });
});
