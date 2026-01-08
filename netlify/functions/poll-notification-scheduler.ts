import { Handler, HandlerEvent } from "@netlify/functions";
import { sendPollNotification } from "../../src/commands/autoPollCommand";
import { getYouthEventsForDateRange } from "../../src/services/notionService";
import { shouldSendNotification } from "../../src/utils/pollScheduler";
import { logInfo, logError } from "../../src/utils/logger";
import { addDays } from "../../src/utils/dateHelper";

/**
 * Netlify Scheduled Function for sending poll notifications to administrator
 * Runs every hour to check for events starting in 3 hours
 *
 * To schedule this function, add to netlify.toml:
 * [functions."poll-notification-scheduler"]
 *   schedule = "0 * * * *"
 */
export const handler: Handler = async (event: HandlerEvent) => {
  logInfo("Poll notification scheduler triggered", {
    eventType: event.httpMethod,
    userAgent: event.headers["user-agent"],
    timestamp: new Date().toISOString(),
  });

  try {
    const now = new Date();
    
    // Search for events on tomorrow (next day)
    // Start from beginning of tomorrow
    const tomorrow = addDays(now, 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    // End at end of tomorrow
    const endOfTomorrow = new Date(tomorrow);
    endOfTomorrow.setHours(23, 59, 59, 999);
    
    logInfo("Checking for events requiring notifications", {
      now: now.toISOString(),
      tomorrow: tomorrow.toISOString(),
      endOfTomorrow: endOfTomorrow.toISOString(),
      nowLocal: now.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }),
      tomorrowLocal: tomorrow.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }),
    });
    
    // Get youth events for tomorrow
    const events = await getYouthEventsForDateRange(tomorrow, endOfTomorrow, [
      "Молодежное",
      "МОСТ",
    ]);
    
    if (events.length === 0) {
      logInfo("No events found for tomorrow, skipping notifications", {
        searchRange: {
          start: tomorrow.toISOString(),
          end: endOfTomorrow.toISOString(),
        },
        eventTypes: ["Молодежное", "МОСТ"],
      });
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: "No events found requiring notifications",
        }),
      };
    }
    
    logInfo("Found events to check", { count: events.length });
    
    let notificationsSent = 0;
    let notificationsSkipped = 0;
    
    for (const event of events) {
      if (shouldSendNotification(event.date, now)) {
        logInfo("Sending notification for event", {
          eventId: event.id,
          eventTitle: event.title,
          eventDate: event.date.toISOString(),
        });
        
        const result = await sendPollNotification(event, event.date);
        
        if (result.success) {
          notificationsSent++;
        } else {
          logError("Failed to send notification", {
            eventId: event.id,
            error: result.error,
          });
        }
      } else {
        notificationsSkipped++;
        logInfo("Skipping notification for event (not in notification window)", {
          eventId: event.id,
          eventDate: event.date.toISOString(),
        });
      }
    }
    
    // Also check for missing events (events that should exist but don't)
    // This is a simplified check - in a real scenario, you might want to check
    // for expected events based on a schedule
    if (notificationsSent === 0 && events.length === 0) {
      logInfo("No events found - this might indicate missing events");
    }
    
    logInfo("Poll notification scheduler completed", {
      eventsChecked: events.length,
      notificationsSent,
      notificationsSkipped,
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Poll notification scheduler completed successfully",
        data: {
          eventsChecked: events.length,
          notificationsSent,
          notificationsSkipped,
        },
      }),
    };
  } catch (error) {
    logError("Error in poll notification scheduler", error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};

