import { generatePollContent } from "./pollTextGenerator";
import { CalendarItem } from "../types";

jest.mock("./logger", () => ({ logInfo: jest.fn() }));

function mkEvent(overrides: Partial<CalendarItem> = {}): CalendarItem {
  return {
    id: "1",
    title: "Молодежное",
    date: new Date(2025, 0, 20, 19, 0, 0, 0),
    type: "service",
    ...overrides,
  };
}

describe("pollTextGenerator", () => {
  describe("generatePollContent", () => {
    it("returns question and options tuple", () => {
      const event = mkEvent();
      const { question, options } = generatePollContent(event);
      expect(typeof question).toBe("string");
      expect(question.length).toBeGreaterThan(0);
      expect(Array.isArray(options)).toBe(true);
      expect(options).toHaveLength(2);
      expect(typeof options[0]).toBe("string");
      expect(typeof options[1]).toBe("string");
    });
    it("МОСТ: question does not include theme placeholder", () => {
      const event = mkEvent({ serviceType: "МОСТ" });
      const { question } = generatePollContent(event);
      expect(question).toMatch(/МОСТ|Молодежное общение/);
    });
    it("with theme: question can include theme", () => {
      const event = mkEvent({ theme: "Вера" });
      const { question } = generatePollContent(event);
      expect(question).toContain("Вера");
    });
    it("date-only (00:00 UTC): uses default 19:00 in question", () => {
      const d = new Date(Date.UTC(2025, 0, 20, 0, 0, 0, 0));
      const event = mkEvent({ date: d });
      const { question } = generatePollContent(event);
      expect(question).toContain("19:00");
    });
    it("with time: formatted time appears in question", () => {
      const d = new Date(Date.UTC(2025, 0, 20, 18, 30, 0, 0));
      const event = mkEvent({ date: d });
      const { question } = generatePollContent(event);
      expect(question).toMatch(/\d{1,2}:\d{2}/);
    });
  });
});
