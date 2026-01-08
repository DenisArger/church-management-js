import { Handler, HandlerEvent } from "@netlify/functions";
import { sendPollNotification } from "../../src/commands/autoPollCommand";
import { getYouthEventsForDateRange } from "../../src/services/notionService";
import { shouldSendNotification } from "../../src/utils/pollScheduler";
import { logInfo, logError } from "../../src/utils/logger";

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
    
    // Check events in the next 4 hours (to catch events starting in 3 hours)
    const endDate = new Date(now);
    endDate.setHours(endDate.getHours() + 4);
    
    logInfo("Checking for events requiring notifications", {
      now: now.toISOString(),
      endDate: endDate.toISOString(),
    });
    
    // Get youth events in the range
    const events = await getYouthEventsForDateRange(now, endDate, [
      "Молодежное",
      "МОСТ",
    ]);
    
    if (events.length === 0) {
      logInfo("No events found in range, skipping notifications");
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

