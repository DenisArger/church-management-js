import {
  parsePrayerInput,
  formatDateRange,
  getPrayerInputHelp,
  calculateWeekDates,
  createWeeklyPrayerInput,
} from "./prayerInputParser";

describe("prayerInputParser", () => {
  describe("parsePrayerInput", () => {
    it("valid: person | topic | current", () => {
      const r = parsePrayerInput("Иван Петров | Здоровье | current");
      expect(r.isValid).toBe(true);
      expect(r.data?.person).toBe("Иван Петров");
      expect(r.data?.topic).toBe("Здоровье");
      expect(r.data?.weekType).toBe("current");
    });
    it("valid: person | topic | next", () => {
      const r = parsePrayerInput("Мария | Работа | next");
      expect(r.isValid).toBe(true);
      expect(r.data?.weekType).toBe("next");
    });
    it("valid: two parts defaults to current", () => {
      const r = parsePrayerInput("Алексей | Семья");
      expect(r.isValid).toBe(true);
      expect(r.data?.weekType).toBe("current");
    });
    it("invalid: empty", () => {
      const r = parsePrayerInput("");
      expect(r.isValid).toBe(false);
      expect(r.error).toBeDefined();
    });
    it("invalid: only one part", () => {
      const r = parsePrayerInput("Только имя");
      expect(r.isValid).toBe(false);
    });
    it("invalid: person too short", () => {
      const r = parsePrayerInput("И | Тема | current");
      expect(r.isValid).toBe(false);
    });
    it("invalid: topic too short", () => {
      const r = parsePrayerInput("Иван | AB | current");
      expect(r.isValid).toBe(false);
    });
    it("invalid: bad weekType", () => {
      const r = parsePrayerInput("Иван | Тема | other");
      expect(r.isValid).toBe(false);
    });
    it("trims extra spaces", () => {
      const r = parsePrayerInput("  Иван  |  Тема молитвы  | current ");
      expect(r.isValid).toBe(true);
      expect(r.data?.person).toBe("Иван");
      expect(r.data?.topic).toBe("Тема молитвы");
    });
  });

  describe("formatDateRange", () => {
    it("formats start - end", () => {
      const start = new Date(2025, 0, 6);
      const end = new Date(2025, 0, 12);
      expect(formatDateRange(start, end)).toMatch(/\d.*\d.*2025.*-.*\d.*\d.*2025/);
    });
  });

  describe("getPrayerInputHelp", () => {
    it("contains key substrings", () => {
      const h = getPrayerInputHelp();
      expect(h).toContain("Имя");
      expect(h).toContain("Тема");
      expect(h).toContain("current");
      expect(h).toContain("next");
      expect(h).toContain("|");
    });
  });

  describe("calculateWeekDates", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });
    it("current: returns Mon-Sun for a fixed today", () => {
      jest.setSystemTime(new Date(2025, 0, 15)); // Wed 15 Jan 2025
      const { start, end } = calculateWeekDates("current");
      expect(start.getDay()).toBe(1);
      expect(end.getDay()).toBe(0);
      expect(formatDateRange(start, end)).toBeDefined();
    });
    it("next: returns following week Mon-Sun", () => {
      jest.setSystemTime(new Date(2025, 0, 15));
      const { start, end } = calculateWeekDates("next");
      expect(start.getDay()).toBe(1);
      expect(end.getDay()).toBe(0);
      expect(start.getTime()).toBeGreaterThan(new Date(2025, 0, 12).getTime());
    });
  });

  describe("createWeeklyPrayerInput", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2025, 0, 15));
    });
    afterEach(() => {
      jest.useRealTimers();
    });
    it("returns object with person, topic, dateStart, dateEnd", () => {
      const parsed = {
        person: "Иван",
        topic: "Тема",
        weekType: "current" as const,
      };
      const out = createWeeklyPrayerInput(parsed);
      expect(out.person).toBe("Иван");
      expect(out.topic).toBe("Тема");
      expect(out.dateStart).toBeInstanceOf(Date);
      expect(out.dateEnd).toBeInstanceOf(Date);
    });
  });
});
