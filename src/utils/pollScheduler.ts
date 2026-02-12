import { logInfo, logWarn } from "./logger";

const MOSCOW_TIMEZONE = "Europe/Moscow";
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

const toMoscowTimestamp = (date: Date): number => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: MOSCOW_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const pick = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value || "0");

  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  const hour = pick("hour");
  const minute = pick("minute");
  const second = pick("second");

  return Date.UTC(year, month - 1, day, hour, minute, second, 0);
};

const getMoscowDateParts = (date: Date) => {
  const moscowMs = toMoscowTimestamp(date);
  const moscowDate = new Date(moscowMs);
  return {
    moscowMs,
    year: moscowDate.getUTCFullYear(),
    month: moscowDate.getUTCMonth(),
    day: moscowDate.getUTCDate(),
    weekday: moscowDate.getUTCDay(), // 0 = Sunday ... 6 = Saturday (Moscow local)
  };
};

const isWithinMoscowWindow = (
  date: Date,
  target: { weekday: number; hour: number; minute: number },
  windowMs: number = FIFTEEN_MINUTES_MS
): boolean => {
  const parts = getMoscowDateParts(date);
  if (parts.weekday !== target.weekday) return false;

  const targetMs = Date.UTC(
    parts.year,
    parts.month,
    parts.day,
    target.hour,
    target.minute,
    0,
    0
  );
  const diff = parts.moscowMs - targetMs;
  return diff >= 0 && diff < windowMs;
};

const isWithinMoscowTimeWindow = (
  date: Date,
  target: { hour: number; minute: number },
  windowMs: number = FIFTEEN_MINUTES_MS
): boolean => {
  const parts = getMoscowDateParts(date);
  const targetMs = Date.UTC(
    parts.year,
    parts.month,
    parts.day,
    target.hour,
    target.minute,
    0,
    0
  );
  const diff = parts.moscowMs - targetMs;
  return diff >= 0 && diff < windowMs;
};

const isLastDayOfMoscowMonth = (date: Date): boolean => {
  const parts = getMoscowDateParts(date);
  const lastDay = new Date(Date.UTC(parts.year, parts.month + 1, 0)).getUTCDate();
  return parts.day === lastDay;
};

/**
 * Calculate poll send time: exactly 24 hours before event at the same time
 */
export const calculatePollSendTime = (eventDate: Date): Date => {
  const eventTime = new Date(eventDate);
  
  // Calculate exactly 24 hours before event, keeping the same time
  const sendTime = new Date(eventTime);
  sendTime.setHours(sendTime.getHours() - 24);
  
  logInfo("Calculated poll send time", {
    eventDate: eventDate.toISOString(),
    calculatedSendTime: sendTime.toISOString(),
    hoursBeforeEvent: 24,
  });
  
  return sendTime;
};

/**
 * Check if poll should be sent now (exactly 24 hours before event at the same time)
 * Poll can be sent within 15 minutes after the calculated send time for reliability
 */
export const shouldSendPoll = (
  eventDate: Date,
  currentTime: Date = new Date()
): boolean => {
  // Check that we haven't passed the event
  if (eventDate.getTime() <= currentTime.getTime()) {
    logWarn("Event has already passed, should not send poll", {
      eventDate: eventDate.toISOString(),
      currentTime: currentTime.toISOString(),
    });
    return false;
  }
  
  const sendTime = calculatePollSendTime(eventDate);
  
  // Check if current time is at or past the send time, but not more than 15 minutes past
  const timeDiff = currentTime.getTime() - sendTime.getTime();
  
  // Allow sending if we're within 15 minutes after the calculated send time
  if (timeDiff >= 0 && timeDiff < FIFTEEN_MINUTES_MS) {
    logInfo("Should send poll now", {
      eventDate: eventDate.toISOString(),
      sendTime: sendTime.toISOString(),
      currentTime: currentTime.toISOString(),
      timeDiffMinutes: Math.round(timeDiff / (60 * 1000)),
    });
    return true;
  }
  
  // Too early or too late
  if (timeDiff < 0) {
    logInfo("Too early to send poll", {
      eventDate: eventDate.toISOString(),
      sendTime: sendTime.toISOString(),
      currentTime: currentTime.toISOString(),
      minutesUntilSend: Math.round(-timeDiff / (60 * 1000)),
    });
  } else {
    logWarn("Send time has passed (more than 15 minutes ago)", {
      eventDate: eventDate.toISOString(),
      sendTime: sendTime.toISOString(),
      currentTime: currentTime.toISOString(),
      minutesSinceSend: Math.round(timeDiff / (60 * 1000)),
    });
  }
  
  return false;
};

/**
 * Check if notification should be sent (exactly 3 hours before event)
 * Notification can be sent within 15 minutes after 3 hours before event for reliability
 */
export const shouldSendNotification = (
  eventDate: Date,
  currentTime: Date = new Date()
): boolean => {
  // Notification should be sent 3 hours before poll send time.
  // Poll send time is 24h before event, so notification time is 27h before event.
  const eventMoscowMs = toMoscowTimestamp(eventDate);
  const nowMoscowMs = toMoscowTimestamp(currentTime);
  const notificationTimeMs = eventMoscowMs - 27 * 60 * 60 * 1000;

  // Allow sending only after target time, within the next 15 minutes
  const timeDiff = nowMoscowMs - notificationTimeMs;
  if (timeDiff >= 0 && timeDiff < FIFTEEN_MINUTES_MS) {
    logInfo("Should send notification now", {
      eventDate: eventDate.toISOString(),
      currentTime: currentTime.toISOString(),
      eventMoscow: new Date(eventMoscowMs).toISOString(),
      notificationTimeMoscow: new Date(notificationTimeMs).toISOString(),
      currentTimeMoscow: new Date(nowMoscowMs).toISOString(),
      timeDiffMinutes: Math.round(timeDiff / (60 * 1000)),
    });
    return true;
  }

  return false;
};

/**
 * Check if weekly schedule should be sent to the group.
 * Target time: Monday 09:00 (Europe/Moscow), 15-minute window after target.
 */
export const shouldSendWeeklySchedule = (
  currentTime: Date = new Date()
): boolean => {
  if (isWithinMoscowWindow(currentTime, { weekday: 1, hour: 9, minute: 0 })) {
    logInfo("Should send weekly schedule now", {
      currentTime: currentTime.toISOString(),
    });
    return true;
  }
  return false;
};

/**
 * Check if preliminary weekly schedule should be sent to administrator.
 * Target time: Sunday 18:00 (Europe/Moscow), 15-minute window after target.
 */
export const shouldSendAdminWeeklySchedule = (
  currentTime: Date = new Date()
): boolean => {
  if (isWithinMoscowWindow(currentTime, { weekday: 0, hour: 18, minute: 0 })) {
    logInfo("Should send admin weekly schedule now", {
      currentTime: currentTime.toISOString(),
    });
    return true;
  }
  return false;
};

/**
 * Check if monthly youth report reminder should be sent to administrators.
 * Target time: last day of month at 11:00 (Europe/Moscow), 15-minute window after target.
 */
export const shouldSendYouthReportReminder = (
  currentTime: Date = new Date()
): boolean => {
  if (!isLastDayOfMoscowMonth(currentTime)) return false;
  if (isWithinMoscowTimeWindow(currentTime, { hour: 11, minute: 0 })) {
    logInfo("Should send youth report reminder now", {
      currentTime: currentTime.toISOString(),
    });
    return true;
  }
  return false;
};

/**
 * Check if youth prayer/communication reminder should be sent to administrators.
 * Target time: 12th and 20th of month at 17:30 (Europe/Moscow), 15-minute window after target.
 */
export const shouldSendYouthCareReminder = (
  currentTime: Date = new Date()
): boolean => {
  const parts = getMoscowDateParts(currentTime);
  if (parts.day !== 12 && parts.day !== 20) return false;
  if (isWithinMoscowTimeWindow(currentTime, { hour: 17, minute: 30 })) {
    logInfo("Should send youth care reminder now", {
      currentTime: currentTime.toISOString(),
    });
    return true;
  }
  return false;
};

/**
 * Check if event is missing from calendar (for notification purposes)
 */
export const isEventMissing = (event: { date: Date } | null): boolean => {
  return event === null;
};

/**
 * Check if event has theme
 */
export const hasTheme = (event: { theme?: string; title?: string } | null): boolean => {
  if (!event) return false;
  const theme = event.theme?.trim();
  const title = event.title?.trim();
  return !!(theme && theme.length > 0) || !!(title && title.length > 0);
};

/**
 * Check if event has time set (not just date)
 */
export const hasTime = (event: { date: Date } | null): boolean => {
  if (!event) return false;
  // Check if date has time component (not just 00:00:00 UTC)
  const isDateOnly = event.date.getUTCHours() === 0 && 
                     event.date.getUTCMinutes() === 0 && 
                     event.date.getUTCSeconds() === 0 &&
                     event.date.getUTCMilliseconds() === 0;
  return !isDateOnly;
};
