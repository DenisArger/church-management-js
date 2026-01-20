import { formatWeeklyScheduleMessage } from "./weeklyScheduleFormatter";
import { WeeklyScheduleInfo } from "../types";

jest.mock("./blessingGenerator", () => ({
  getRandomBlessing: jest.fn(() => ({ text: "Blessing", reference: "Gen 1:1" })),
  formatBlessing: jest.fn(() => '"Blessing"\n(Gen 1:1)'),
}));
jest.mock("./logger", () => ({ logInfo: jest.fn() }));

describe("weeklyScheduleFormatter", () => {
  describe("formatWeeklyScheduleMessage", () => {
    it("scheduleInfo === null -> message without dates", () => {
      const out = formatWeeklyScheduleMessage(null);
      expect(out).toMatch(/Расписание|служений|Неделя|не запланировано/i);
    });
    it("services.length === 0 -> empty week message", () => {
      const info: WeeklyScheduleInfo = {
        startDate: new Date(2025, 0, 13),
        endDate: new Date(2025, 0, 19),
        services: [],
      };
      const out = formatWeeklyScheduleMessage(info);
      expect(out).toMatch(/Расписание|не запланировано|январ|2025/i);
    });
    it("one service -> contains date, title, type", () => {
      const info: WeeklyScheduleInfo = {
        startDate: new Date(2025, 0, 13),
        endDate: new Date(2025, 0, 19),
        services: [
          {
            id: "1",
            title: "Молодежное",
            date: new Date(2025, 0, 15, 19, 0),
            type: "service",
            needsMailing: true,
          },
        ],
      };
      const out = formatWeeklyScheduleMessage(info);
      expect(out).toMatch(/Расписание|Молодежное|служений/i);
      expect(out).toMatch(/\d|январ|15/i);
    });
  });
});
