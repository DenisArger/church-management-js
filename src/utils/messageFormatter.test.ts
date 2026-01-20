import {
  formatAllPeopleMessage,
  formatOldPrayersMessage,
  groupPrayerRecordsByPerson,
  sortPeopleByName,
  sortPeopleByDate,
  getOldPrayersForSelection,
} from "./messageFormatter";
import { PrayerRecord } from "../types";

describe("messageFormatter", () => {
  const mkRecord = (overrides: Partial<PrayerRecord> = {}): PrayerRecord => ({
    id: "1",
    person: "Иван",
    topic: "Здоровье",
    note: "",
    dateStart: new Date(2025, 0, 1),
    dateEnd: new Date(2025, 0, 7),
    ...overrides,
  });

  describe("formatAllPeopleMessage", () => {
    it("formats list with sort description", () => {
      const list = [{ person: "A", date: new Date(2025, 0, 1), record: mkRecord({ person: "A" }) }];
      const out = formatAllPeopleMessage(list, "по дате");
      expect(out).toContain("Список всех людей");
      expect(out).toContain("по дате");
      expect(out).toContain("A");
    });
  });

  describe("formatOldPrayersMessage", () => {
    it("formats old prayers block", () => {
      const list = [{ person: "B", date: new Date(2024, 11, 1), record: mkRecord({ person: "B", topic: "Тема" }) }];
      const out = formatOldPrayersMessage(list);
      expect(out).toMatch(/давно не молились|молитвенное лицо|Тема/i);
    });
  });

  describe("groupPrayerRecordsByPerson", () => {
    it("keeps latest per person", () => {
      const records = [
        mkRecord({ person: "X", dateStart: new Date(2025, 0, 1) }),
        mkRecord({ person: "X", dateStart: new Date(2025, 0, 5) }),
      ];
      const m = groupPrayerRecordsByPerson(records);
      expect(m.size).toBe(1);
      expect(m.get("X")!.date.getTime()).toBe(new Date(2025, 0, 5).getTime());
    });
  });

  describe("sortPeopleByName", () => {
    it("sorts alphabetically", () => {
      const list = [
        { person: "Z", date: new Date(), record: mkRecord({ person: "Z" }) },
        { person: "A", date: new Date(), record: mkRecord({ person: "A" }) },
      ];
      const out = sortPeopleByName(list);
      expect(out[0].person).toBe("A");
    });
  });

  describe("sortPeopleByDate", () => {
    it("sorts by date ascending", () => {
      const list = [
        { person: "B", date: new Date(2025, 0, 5), record: mkRecord({ person: "B" }) },
        { person: "A", date: new Date(2025, 0, 1), record: mkRecord({ person: "A" }) },
      ];
      const out = sortPeopleByDate(list);
      expect(out[0].person).toBe("A");
    });
  });

  describe("getOldPrayersForSelection", () => {
    it("returns up to limit oldest", () => {
      const records = [
        mkRecord({ person: "1", dateStart: new Date(2024, 0, 1) }),
        mkRecord({ person: "2", dateStart: new Date(2024, 0, 2) }),
        mkRecord({ person: "3", dateStart: new Date(2024, 0, 3) }),
      ];
      const out = getOldPrayersForSelection(records, 2);
      expect(out).toHaveLength(2);
    });
  });
});
