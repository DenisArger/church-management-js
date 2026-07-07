import {
  composeYouTubeBroadcastCaption,
  getBroadcastPhotoId,
  buildWatchButton,
} from "./youtubeBroadcastWording";

describe("youtubeBroadcastWording", () => {
  describe("composeYouTubeBroadcastCaption", () => {
    it("returns sunday wording for Sunday broadcasts", () => {
      const caption = composeYouTubeBroadcastCaption(
        "abc123XYZ",
        "Утреннее служение",
        "2026-07-12T07:00:00Z",
        0
      );
      expect(caption).toContain("Наступил этот день воскресенья\\!");
      expect(caption).toContain("Предавай все дела забвенью\\!");
      expect(caption).toContain("Подключись, чтобы услышать слово\\!");
      expect(caption).toContain("[Трансляция в 10:00](https://youtu.be/abc123XYZ)");
      expect(caption).toMatch(/\n/);
    });

    it("returns general wording for non-Sunday broadcasts", () => {
      const caption = composeYouTubeBroadcastCaption(
        "abc123XYZ",
        "Вечернее служение",
        "2026-07-13T07:00:00Z",
        0
      );
      expect(caption).toContain("*Вечернее служение*");
      expect(caption).toContain("[Трансляция в 10:00](https://youtu.be/abc123XYZ)");
      expect(caption).not.toContain("воскресенья");
    });

    it("escapes special chars in title", () => {
      const caption = composeYouTubeBroadcastCaption(
        "abc123XYZ",
        "Утреннее служение! & Завтрак",
        "2026-07-13T07:00:00Z",
        0
      );
      expect(caption).toContain("*Утреннее служение\\! & Завтрак*");
    });

    it("rotates Sunday variants and link prefixes", () => {
      const a = composeYouTubeBroadcastCaption(
        "abc",
        "Title",
        "2026-07-12T07:00:00Z",
        0
      );
      const b = composeYouTubeBroadcastCaption(
        "def",
        "Title",
        "2026-07-12T07:00:00Z",
        2
      );
      expect(a).not.toBe(b);
      expect(a).toContain("[Трансляция в ");
      expect(b).toMatch(/\[(Смотрите в|Эфир в|Начало в) /);
    });
  });

  describe("getBroadcastPhotoId", () => {
    it("returns the fixed photo ID", () => {
      expect(getBroadcastPhotoId()).toBe(
        "AgACAgIAAxkBAAOyYlj-ys3nUbfITLexZ7zTwVcB5toAAkO4MRuYUclKFc7DAUhHXpoBAAMCAAN5AAMjBA"
      );
    });
  });

  describe("buildWatchButton", () => {
    it("returns inline keyboard with watch URL", () => {
      const button = buildWatchButton("abc123XYZ");
      expect(button).toHaveProperty("inline_keyboard");
      expect(button.inline_keyboard[0][0]).toEqual({
        text: "Смотреть...",
        url: "https://youtu.be/abc123XYZ",
      });
    });
  });
});
