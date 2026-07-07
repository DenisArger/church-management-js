import { escapeMarkdownV2 } from "./markdownV2Composer";

describe("markdownV2Composer", () => {
  describe("escapeMarkdownV2", () => {
    it("escapes underscore", () => {
      expect(escapeMarkdownV2("_text_")).toBe("\\_text\\_");
    });

    it("escapes asterisk", () => {
      expect(escapeMarkdownV2("*text*")).toBe("\\*text\\*");
    });

    it("escapes brackets", () => {
      expect(escapeMarkdownV2("[link](url)")).toBe("\\[link\\]\\(url\\)");
    });

    it("escapes exclamation", () => {
      expect(escapeMarkdownV2("Hello!")).toBe("Hello\\!");
    });

    it("escapes multiple special chars", () => {
      expect(escapeMarkdownV2("Hello *world*!")).toBe("Hello \\*world\\*\\!");
    });

    it("leaves plain text unchanged", () => {
      expect(escapeMarkdownV2("Привет")).toBe("Привет");
    });
  });
});
