import { PrayerRecord } from "../types";

export interface PrayerPersonInfo {
  person: string;
  date: Date;
  record: PrayerRecord;
}

/**
 * Formats the complete list of all people with their last prayer dates
 */
export const formatAllPeopleMessage = (
  peopleInfo: PrayerPersonInfo[],
  sortDescription: string = "по алфавиту"
): string => {
  let message = `📢 <b>Список всех людей с датами последней молитвы (${sortDescription}):</b>\n\n`;

  for (const info of peopleInfo) {
    message += `🙏 <b>${info.person}</b> - ${
      info.date.toISOString().split("T")[0]
    }\n`;
  }

  return message;
};

/**
 * Formats the message about people who haven't been prayed for recently
 */
export const formatOldPrayersMessage = (
  oldPeople: PrayerPersonInfo[]
): string => {
  let message =
    "📢 <b>Информация о пяти людях, о которых давно не молились:</b>\n\n";

  const seenPeople = new Set<string>();
  const uniquePeople: PrayerPersonInfo[] = [];

  // Remove duplicates based on person, date, and topic
  for (const info of oldPeople) {
    const personKey = `${info.person}-${
      info.date.toISOString().split("T")[0]
    }-${info.record.topic}`;
    if (!seenPeople.has(personKey)) {
      seenPeople.add(personKey);
      uniquePeople.push(info);
    }
  }

  for (const info of uniquePeople) {
    const lastDate = info.date.toISOString().split("T")[0];
    const record = info.record;

    message +=
      `🙏 <b>Молитвенное лицо:</b> ${info.person}\n` +
      `📅 <b>Последняя молитва:</b> ${lastDate}\n` +
      `📝 <b>Тема:</b> ${record.topic}\n` +
      `📌 <b>Примечание:</b> ${record.note}\n` +
      `${"-".repeat(20)}\n`;
  }

  message += "\nБлагословений и хорошего дня!🙏";
  return message;
};

/**
 * Groups prayer records by person and finds the latest prayer date for each person
 */
export const groupPrayerRecordsByPerson = (
  records: PrayerRecord[]
): Map<string, PrayerPersonInfo> => {
  const lastPrayerByPerson = new Map<string, PrayerPersonInfo>();

  for (const record of records) {
    if (!record.dateStart) {
      continue;
    }

    const prayerDate = record.dateStart;
    const existingInfo = lastPrayerByPerson.get(record.person);

    if (!existingInfo || prayerDate > existingInfo.date) {
      lastPrayerByPerson.set(record.person, {
        person: record.person,
        date: prayerDate,
        record: record,
      });
    }
  }

  return lastPrayerByPerson;
};

/**
 * Sorts people by name alphabetically
 */
export const sortPeopleByName = (
  peopleInfo: PrayerPersonInfo[]
): PrayerPersonInfo[] => {
  return [...peopleInfo].sort((a, b) => a.person.localeCompare(b.person));
};

/**
 * Sorts people by prayer date (oldest first)
 */
export const sortPeopleByDate = (
  peopleInfo: PrayerPersonInfo[]
): PrayerPersonInfo[] => {
  return [...peopleInfo].sort((a, b) => a.date.getTime() - b.date.getTime());
};
