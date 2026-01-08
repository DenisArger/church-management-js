import { Handler, HandlerEvent } from "@netlify/functions";
import { executeAutoPollForEvent } from "../../src/commands/autoPollCommand";
import { getYouthEventsForDateRange } from "../../src/services/notionService";
import { shouldSendPoll } from "../../src/utils/pollScheduler";
import { logInfo, logError } from "../../src/utils/logger";

/**
 * Netlify Scheduled Function for sending polls automatically
 * Runs every hour to check for events that need polls sent
 *
 * To schedule this function, add to netlify.toml:
 * [functions."poll-sender-scheduler"]
 *   schedule = "0 * * * *"
 */
export const handler: Handler = async (event: HandlerEvent) => {
  logInfo("Poll sender scheduler triggered", {
    eventType: event.httpMethod,
    userAgent: event.headers["user-agent"],
    timestamp: new Date().toISOString(),
  });

  try {
    const now = new Date();
    
    // Check events in the next 48 hours (to catch events that need polls sent)
    const endDate = new Date(now);
    endDate.setHours(endDate.getHours() + 48);
    
    logInfo("Checking for events requiring polls", {
      now: now.toISOString(),
      endDate: endDate.toISOString(),
    });
    
    // Get youth events in the range
    const events = await getYouthEventsForDateRange(now, endDate, [
      "Молодежное",
      "МОСТ",
    ]);
    
    if (events.length === 0) {
      logInfo("No events found in range, skipping poll sending");
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: "No events found requiring polls",
        }),
      };
    }
    
    logInfo("Found events to check", { count: events.length });
    
    let pollsSent = 0;
    let pollsSkipped = 0;
    
    for (const event of events) {
      if (shouldSendPoll(event.date, now)) {
        logInfo("Sending poll for event", {
          eventId: event.id,
          eventTitle: event.title,
          eventDate: event.date.toISOString(),
        });
        
        const result = await executeAutoPollForEvent(event);
        
        if (result.success) {
          pollsSent++;
        } else {
          logError("Failed to send poll", {
            eventId: event.id,
            error: result.error,
          });
        }
      } else {
        pollsSkipped++;
        logInfo("Skipping poll for event (not in send window)", {
          eventId: event.id,
          eventDate: event.date.toISOString(),
        });
      }
    }
    
    logInfo("Poll sender scheduler completed", {
      eventsChecked: events.length,
      pollsSent,
      pollsSkipped,
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Poll sender scheduler completed successfully",
        data: {
          eventsChecked: events.length,
          pollsSent,
          pollsSkipped,
        },
      }),
    };
  } catch (error) {
    logError("Error in poll sender scheduler", error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};

