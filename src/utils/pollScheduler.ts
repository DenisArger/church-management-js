import { logInfo, logWarn } from "./logger";

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
 * Poll can be sent within 2 minutes after the calculated send time for reliability
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
  
  // Check if current time is at or past the send time, but not more than 2 minutes past
  const timeDiff = currentTime.getTime() - sendTime.getTime();
  const twoMinutesInMs = 2 * 60 * 1000; // 2 minutes window
  
  // Allow sending if we're within 2 minutes after the calculated send time
  if (timeDiff >= 0 && timeDiff < twoMinutesInMs) {
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
    logWarn("Send time has passed (more than 2 minutes ago)", {
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
 * Notification can be sent within 10 minutes after 3 hours before event for reliability
 */
export const shouldSendNotification = (
  eventDate: Date,
  currentTime: Date = new Date()
): boolean => {
  // Calculate 3 hours before event
  const threeHoursBefore = new Date(eventDate);
  threeHoursBefore.setHours(threeHoursBefore.getHours() - 3);
  
  // Check if current time is at or past 3 hours before event, but not more than 10 minutes past
  const timeDiff = currentTime.getTime() - threeHoursBefore.getTime();
  const tenMinutesInMs = 10 * 60 * 1000; // 10 minutes window
  
  // Allow sending if we're within 10 minutes after 3 hours before event
  if (timeDiff >= 0 && timeDiff < tenMinutesInMs) {
    logInfo("Should send notification now", {
      eventDate: eventDate.toISOString(),
      threeHoursBefore: threeHoursBefore.toISOString(),
      currentTime: currentTime.toISOString(),
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
export const hasTheme = (event: { theme?: string } | null): boolean => {
  if (!event) return false;
  return !!event.theme && event.theme.trim().length > 0;
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

