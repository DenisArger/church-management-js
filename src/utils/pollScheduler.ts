import { logInfo, logWarn } from "./logger";

/**
 * Calculate fixed poll send time: exactly 24 hours before event at 18:00
 */
export const calculatePollSendTime = (eventDate: Date): Date => {
  const eventTime = new Date(eventDate);
  
  // Calculate exactly 24 hours before event
  const sendTime = new Date(eventTime);
  sendTime.setHours(sendTime.getHours() - 24);
  
  // Set fixed time to 18:00
  sendTime.setHours(18, 0, 0, 0);
  
  logInfo("Calculated poll send time", {
    eventDate: eventDate.toISOString(),
    calculatedSendTime: sendTime.toISOString(),
    hoursBeforeEvent: 24,
    fixedTime: "18:00",
  });
  
  return sendTime;
};

/**
 * Check if poll should be sent now (at fixed time: 18:00, exactly 24 hours before event)
 * Poll can be sent within 5 minutes after 18:00 to prevent duplicates
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
  
  // Check if current time is at or past the send time, but not more than 5 minutes past
  const timeDiff = currentTime.getTime() - sendTime.getTime();
  const fiveMinutesInMs = 5 * 60 * 1000; // 5 minutes window
  
  // Allow sending if we're within 5 minutes after the fixed send time (18:00)
  if (timeDiff >= 0 && timeDiff < fiveMinutesInMs) {
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
    logWarn("Send time has passed (more than 5 minutes ago)", {
      eventDate: eventDate.toISOString(),
      sendTime: sendTime.toISOString(),
      currentTime: currentTime.toISOString(),
      minutesSinceSend: Math.round(timeDiff / (60 * 1000)),
    });
  }
  
  return false;
};

/**
 * Check if notification should be sent (3 hours before event)
 */
export const shouldSendNotification = (
  eventDate: Date,
  currentTime: Date = new Date()
): boolean => {
  // Calculate 3 hours before event
  const threeHoursBefore = new Date(eventDate);
  threeHoursBefore.setHours(threeHoursBefore.getHours() - 3);
  
  // Check if current time is within 1 hour window before 3 hours before event
  const oneHourBeforeNotification = new Date(threeHoursBefore);
  oneHourBeforeNotification.setHours(oneHourBeforeNotification.getHours() - 1);
  
  // Check if we're in the notification window (1 hour before to 3 hours before event)
  if (
    currentTime.getTime() >= oneHourBeforeNotification.getTime() &&
    currentTime.getTime() <= threeHoursBefore.getTime()
  ) {
    logInfo("Should send notification now", {
      eventDate: eventDate.toISOString(),
      threeHoursBefore: threeHoursBefore.toISOString(),
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
export const hasTheme = (event: { theme?: string } | null): boolean => {
  if (!event) return false;
  return !!event.theme && event.theme.trim().length > 0;
};

