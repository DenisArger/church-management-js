import { Handler, HandlerEvent } from "@netlify/functions";
import { executeYouthPollScheduled } from "../../src/commands/youthPollCommand";
import { ensureAppConfigLoaded } from "../../src/config/appConfigStore";
import { logInfo, logError } from "../../src/utils/logger";

/**
 * Netlify Scheduled Function for automatic youth poll creation
 * Runs daily at 18:00 UTC (21:00 Moscow time) to check for youth events tomorrow
 *
 * To schedule this function, add to netlify.toml:
 * [functions."youth-poll-scheduler"]
 *   schedule = "0 18 * * *"
 */
export const handler: Handler = async (event: HandlerEvent) => {
  await ensureAppConfigLoaded();
  logInfo("Youth poll scheduler triggered", {
    eventType: event.httpMethod,
    userAgent: event.headers["user-agent"],
    timestamp: new Date().toISOString(),
  });

  try {
    // Execute the scheduled youth poll
    const result = await executeYouthPollScheduled();

    if (result.success) {
      logInfo("Scheduled youth poll completed successfully", {
        message: result.message,
        data: result.data,
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: "Youth poll scheduler completed successfully",
          data: result.data,
        }),
      };
    } else {
      logError("Scheduled youth poll failed", {
        error: result.error,
        message: result.message,
      });

      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: result.error || "Unknown error in youth poll scheduler",
        }),
      };
    }
  } catch (error) {
    logError("Error in youth poll scheduler", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
