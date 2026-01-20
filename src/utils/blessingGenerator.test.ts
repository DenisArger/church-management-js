import { formatBlessing, getRandomBlessing } from "./blessingGenerator";

describe("blessingGenerator", () => {
  describe("formatBlessing", () => {
    it("wraps text in quotes and appends reference in parentheses", () => {
      const blessing = { text: "Да благословит Господь", reference: "Числа 6:24" };
      const out = formatBlessing(blessing);
      expect(out).toMatch(/^"/);
      expect(out).toContain("Да благословит Господь");
      expect(out).toContain("(Числа 6:24)");
    });
  });

  describe("getRandomBlessing", () => {
    it("returns object with text and reference", () => {
      const b = getRandomBlessing();
      expect(b).toHaveProperty("text");
      expect(b).toHaveProperty("reference");
    });
    it("reference and text are non-empty", () => {
      for (let i = 0; i < 5; i++) {
        const b = getRandomBlessing();
        expect(b.reference?.length).toBeGreaterThan(0);
        expect(b.text?.length).toBeGreaterThan(0);
      }
    });
  });
});
