import {
  formatServiceType,
  formatBooleanValue,
  formatNumberValue,
  formatSundayServiceMessage,
} from "./sundayServiceFormatter";

jest.mock("../services/calendarService", () => ({
  formatServiceInfo: jest.fn((info: unknown) => `formatted:${JSON.stringify((info as { date?: string })?.date ?? "n")}`),
}));

const formatServiceInfo = jest.requireMock<typeof import("../services/calendarService")>("../services/calendarService").formatServiceInfo;

describe("sundayServiceFormatter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("formatServiceType", () => {
    it("Воскресное-1 -> I поток", () => expect(formatServiceType("Воскресное-1")).toBe("I поток"));
    it("Воскресное-2 -> II поток", () => expect(formatServiceType("Воскресное-2")).toBe("II поток"));
    it("other unchanged", () => expect(formatServiceType("Другое")).toBe("Другое"));
  });

  describe("formatBooleanValue", () => {
    it("true -> есть", () => expect(formatBooleanValue(true)).toBe("есть"));
    it("false -> нет", () => expect(formatBooleanValue(false)).toBe("нет"));
  });

  describe("formatNumberValue", () => {
    it("number -> string", () => expect(formatNumberValue(5)).toBe("5"));
    it("null -> не указано", () => expect(formatNumberValue(null)).toBe("не указано"));
  });

  describe("formatSundayServiceMessage", () => {
    it("null -> no-data message", () => {
      const out = formatSundayServiceMessage(null);
      expect(out).toMatch(/недоступна|не запланировано|баз данных/i);
      expect(formatServiceInfo).not.toHaveBeenCalled();
    });
    it("object -> calls formatServiceInfo and returns result", () => {
      const info = { date: new Date(2025, 0, 19), services: [] };
      (formatServiceInfo as jest.Mock).mockReturnValue("custom");
      const out = formatSundayServiceMessage(info);
      expect(formatServiceInfo).toHaveBeenCalledWith(info);
      expect(out).toBe("custom");
    });
  });
});
