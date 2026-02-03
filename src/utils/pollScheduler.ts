import { logInfo, logWarn } from "./logger";

const MOSCOW_TIMEZONE = "Europe/Moscow";

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
  const fifteenMinutesInMs = 15 * 60 * 1000; // 15 minutes window
  
  // Allow sending if we're within 15 minutes after the calculated send time
  if (timeDiff >= 0 && timeDiff < fifteenMinutesInMs) {
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

  // Allow a 15-minute window on both sides of notification time
  const timeDiff = nowMoscowMs - notificationTimeMs;
  const fifteenMinutesInMs = 15 * 60 * 1000; // 15 minutes window

  if (Math.abs(timeDiff) < fifteenMinutesInMs) {
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

