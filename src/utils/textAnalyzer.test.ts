import {
  extractPrayerKeywords,
  categorizePrayerNeed,
  isPrayerRequest,
} from "./textAnalyzer";

describe("textAnalyzer", () => {
  describe("extractPrayerKeywords", () => {
    it("returns matching keywords", () => {
      expect(extractPrayerKeywords("молитва о здоровье")).toContain("молитва");
      expect(extractPrayerKeywords("молитва о здоровье")).toContain("здоровье");
    });
    it("returns empty for no matches", () => {
      expect(extractPrayerKeywords("привет как дела")).toEqual([]);
    });
    it("is case insensitive", () => {
      expect(extractPrayerKeywords("МОЛИТВА и семья")).toContain("молитва");
      expect(extractPrayerKeywords("МОЛИТВА и семья")).toContain("семья");
    });
  });

  describe("categorizePrayerNeed", () => {
    it("returns здоровье for health-related", () => {
      expect(categorizePrayerNeed("болезнь мамы")).toBe("здоровье");
      expect(categorizePrayerNeed("лечение")).toBe("здоровье");
    });
    it("returns семья for family-related", () => {
      expect(categorizePrayerNeed("молитва за семья")).toBe("семья");
    });
    it("returns работа for work-related", () => {
      expect(categorizePrayerNeed("карьера и деньги")).toBe("работа");
    });
    it("returns духовность for faith-related", () => {
      expect(categorizePrayerNeed("вера и служение")).toBe("духовность");
    });
    it("returns путешествие for travel", () => {
      expect(categorizePrayerNeed("поездка и безопасность")).toBe("путешествие");
    });
    it("returns общее when no category matches", () => {
      expect(categorizePrayerNeed("просто текст")).toBe("общее");
    });
    it("returns общее for explicit общее", () => {
      expect(categorizePrayerNeed("общее")).toBe("общее");
    });
  });

  describe("isPrayerRequest", () => {
    it("returns true for молитесь", () => {
      expect(isPrayerRequest("Помолитесь пожалуйста")).toBe(true);
    });
    it("returns true for просьба", () => {
      expect(isPrayerRequest("просьба о помощи")).toBe(true);
    });
    it("returns true for нужда", () => {
      expect(isPrayerRequest("есть нужда")).toBe(true);
    });
    it("returns true for молитва", () => {
      expect(isPrayerRequest("молитва о семье")).toBe(true);
    });
    it("returns false for neutral text", () => {
      expect(isPrayerRequest("привет как дела")).toBe(false);
    });
  });
});
