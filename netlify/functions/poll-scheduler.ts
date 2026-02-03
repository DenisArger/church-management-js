import { Handler, HandlerEvent } from "@netlify/functions";
import {
  executeAutoPollForEvent,
  sendPollNotification,
} from "../../src/commands/autoPollCommand";
import {
  sendAdminWeeklySchedule,
  sendWeeklyScheduleToChat,
} from "../../src/commands/weeklyScheduleCommand";
import { sendYouthCareReminderToAdmins } from "../../src/commands/youthCareReminderCommand";
import { sendYouthReportReminderToAdmins } from "../../src/commands/youthReportReminderCommand";
import { getTelegramConfig } from "../../src/config/environment";
import { getYouthEventsForDateRange } from "../../src/services/notionService";
import {
  shouldSendAdminWeeklySchedule,
  shouldSendNotification,
  shouldSendPoll,
  shouldSendYouthCareReminder,
  shouldSendYouthReportReminder,
  shouldSendWeeklySchedule,
} from "../../src/utils/pollScheduler";
import { ensureAppConfigLoaded } from "../../src/config/appConfigStore";
import { logInfo, logWarn, logError } from "../../src/utils/logger";

/**
 * Netlify Scheduled Function for sending polls and notifications
 * Runs every 15 minutes to check for events that need polls or notifications
 *
 * To schedule this function, add to netlify.toml:
 * [functions."poll-scheduler"]
 *   schedule = "every 15 minutes"
 */
const getSchedulerNow = (): Date => {
  const raw = String(process.env.SCHEDULER_NOW_ISO ?? "").trim();
  if (!raw) return new Date();
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) {
    logWarn("Invalid SCHEDULER_NOW_ISO, using real time", { raw });
    return new Date();
  }
  logInfo("Using overridden scheduler time", { now: parsed.toISOString() });
  return parsed;
};

export const handler: Handler = async (event: HandlerEvent) => {
  await ensureAppConfigLoaded();
  logInfo("Poll scheduler triggered", {
    eventType: event.httpMethod,
    userAgent: event.headers["user-agent"],
    timestamp: new Date().toISOString(),
  });

  try {
    const now = getSchedulerNow();

    const forceDebug = String(process.env.SCHEDULER_FORCE_DEBUG ?? "").trim() === "true";

    // Weekly schedule sends (Moscow time)
    if (shouldSendWeeklySchedule(now)) {
      const telegramConfig = getTelegramConfig();
      const rawMainGroupId = telegramConfig.mainGroupId;
      const rawMainTopicId = telegramConfig.announcementsTopicId;
      const mainGroupId =
        rawMainGroupId && rawMainGroupId.trim().length > 0
          ? parseInt(rawMainGroupId.trim(), 10)
          : NaN;
      const mainTopicId =
        rawMainTopicId && rawMainTopicId.trim().length > 0
          ? parseInt(rawMainTopicId.trim(), 10)
          : NaN;

      if (!isNaN(mainGroupId)) {
        const result = await sendWeeklyScheduleToChat(mainGroupId, "current", {
          suppressDebugMessage: false,
          forceDebug,
          messageThreadId: !isNaN(mainTopicId) ? mainTopicId : undefined,
          context: { source: "poll-scheduler" },
        });

        if (!result.success) {
          logError("Failed to send weekly schedule", {
            error: result.error,
            chatId: mainGroupId,
          });
        }
      } else {
        logWarn("Weekly schedule skipped: TELEGRAM_MAIN_GROUP_ID not set");
      }
    }

    if (shouldSendAdminWeeklySchedule(now)) {
      const result = await sendAdminWeeklySchedule("next", {
        suppressDebugMessage: false,
        forceDebug,
        context: { source: "poll-scheduler" },
      });

      if (!result.success) {
        logError("Failed to send admin weekly schedule", {
          error: result.error,
        });
      }
    }

    if (shouldSendYouthReportReminder(now)) {
      const result = await sendYouthReportReminderToAdmins({
        suppressDebugMessage: false,
        forceDebug,
        context: { source: "poll-scheduler" },
      });

      if (!result.success) {
        logError("Failed to send youth report reminders", {
          error: result.error,
        });
      }
    }

    if (shouldSendYouthCareReminder(now)) {
      const result = await sendYouthCareReminderToAdmins({
        suppressDebugMessage: false,
        forceDebug,
        context: { source: "poll-scheduler" },
      });

      if (!result.success) {
        logError("Failed to send youth care reminders", {
          error: result.error,
        });
      }
    }

    const endDate = new Date(now);
    endDate.setHours(endDate.getHours() + 48);

    logInfo("Checking for events requiring polls or notifications", {
      now: now.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Get youth events in the range (includes "Молодежное" and "МОСТ")
    const events = await getYouthEventsForDateRange(now, endDate);

    if (events.length === 0) {
      logInfo("No events found in range, skipping scheduler work");
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: "No events found requiring polls or notifications",
        }),
      };
    }

    logInfo("Found events to check", { count: events.length });

    let pollsSent = 0;
    let pollsSkipped = 0;
    let notificationsSent = 0;
    let notificationsSkipped = 0;

    for (const eventItem of events) {
      if (shouldSendPoll(eventItem.date, now)) {
        logInfo("Sending poll for event", {
          eventId: eventItem.id,
          eventTitle: eventItem.title,
          eventDate: eventItem.date.toISOString(),
        });

        const result = await executeAutoPollForEvent(eventItem);

        if (result.success) {
          pollsSent++;
        } else {
          logError("Failed to send poll", {
            eventId: eventItem.id,
            error: result.error,
          });
        }
      } else {
        pollsSkipped++;
      }

      if (shouldSendNotification(eventItem.date, now)) {
        logInfo("Sending notification for event", {
          eventId: eventItem.id,
          eventTitle: eventItem.title,
          eventDate: eventItem.date.toISOString(),
        });

        const result = await sendPollNotification(eventItem, eventItem.date);

        if (result.success) {
          notificationsSent++;
        } else {
          logError("Failed to send notification", {
            eventId: eventItem.id,
            error: result.error,
          });
        }
      } else {
        notificationsSkipped++;
      }
    }

    logInfo("Poll scheduler completed", {
      eventsChecked: events.length,
      pollsSent,
      pollsSkipped,
      notificationsSent,
      notificationsSkipped,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Poll scheduler completed successfully",
        data: {
          eventsChecked: events.length,
          pollsSent,
          pollsSkipped,
          notificationsSent,
          notificationsSkipped,
        },
      }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError("Error in poll scheduler", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
      }),
    };
  }
};
