import {
  buildMainMenu,
  buildPrayerMenu,
  buildScheduleMenu,
  buildSundayMenu,
  parseCallbackData,
} from "./menuBuilder";

describe("menuBuilder", () => {
  describe("buildMainMenu", () => {
    it("returns inline_keyboard with expected structure", () => {
      const m = buildMainMenu();
      expect(m).toHaveProperty("inline_keyboard");
      expect(Array.isArray(m.inline_keyboard)).toBe(true);
    });
    it("contains create_poll and menu:prayer, menu:schedule, menu:sunday", () => {
      const flat = buildMainMenu().inline_keyboard.flat();
      const data = flat.map((b) => b.callback_data).filter(Boolean);
      expect(data).toContain("cmd:create_poll");
      expect(data).toContain("menu:prayer");
      expect(data).toContain("menu:schedule");
      expect(data).toContain("menu:sunday");
    });
  });

  describe("buildPrayerMenu", () => {
    it("contains prayer commands and menu:main back", () => {
      const flat = buildPrayerMenu().inline_keyboard.flat();
      const data = flat.map((b) => b.callback_data).filter(Boolean);
      expect(data).toContain("cmd:prayer_week");
      expect(data).toContain("cmd:add_prayer");
      expect(data).toContain("menu:main");
    });
  });

  describe("buildScheduleMenu", () => {
    it("contains weekly_schedule, edit_schedule, menu:main", () => {
      const flat = buildScheduleMenu().inline_keyboard.flat();
      const data = flat.map((b) => b.callback_data).filter(Boolean);
      expect(data.some((d) => d && d.includes("weekly_schedule"))).toBe(true);
      expect(data).toContain("cmd:edit_schedule");
      expect(data).toContain("menu:main");
    });
  });

  describe("buildSundayMenu", () => {
    it("contains request_state_sunday, fill_sunday_service, menu:main", () => {
      const flat = buildSundayMenu().inline_keyboard.flat();
      const data = flat.map((b) => b.callback_data).filter(Boolean);
      expect(data).toContain("cmd:request_state_sunday");
      expect(data.some((d) => d && (d === "cmd:fill_sunday_service" || d.includes("fill_sunday")))).toBe(true);
      expect(data).toContain("menu:main");
    });
  });

  describe("parseCallbackData", () => {
    it("cmd: with params", () => {
      const r = parseCallbackData("cmd:weekly_schedule:select");
      expect(r.type).toBe("cmd");
      expect(r.command).toBe("weekly_schedule");
      expect(r.params).toEqual(["select"]);
    });
    it("cmd: only command", () => {
      const r = parseCallbackData("cmd:create_poll");
      expect(r.type).toBe("cmd");
      expect(r.command).toBe("create_poll");
      expect(r.params).toEqual([]);
    });
    it("menu: with submenu", () => {
      const r = parseCallbackData("menu:prayer");
      expect(r.type).toBe("menu");
      expect(r.command).toBe("prayer");
    });
    it("menu: main", () => {
      const r = parseCallbackData("menu:main");
      expect(r.type).toBe("menu");
      expect(r.command).toBe("main");
    });
    it("unknown type for unrecognized", () => {
      const r = parseCallbackData("x:y:z");
      expect(r.type).toBe("unknown");
    });
  });
});
