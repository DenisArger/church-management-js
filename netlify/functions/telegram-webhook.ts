import { Handler } from "@netlify/functions";
import { config } from "dotenv";
import { handleUpdate } from "../../src/handlers/messageHandler";
import { validateEnvironment } from "../../src/config/environment";
import { logInfo, logError } from "../../src/utils/logger";

// Load environment variables (dotenv is already called in environment.ts, but ensure it's loaded here too)
config();

// Validate environment on startup
try {
  validateEnvironment();
  logInfo("Environment validation passed");
} catch (error) {
  logError("Environment validation failed", error);
}

export const handler: Handler = async (event) => {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle preflight requests
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const update = JSON.parse(event.body || "{}");
    logInfo("Received webhook update", {
      updateId: update.update_id,
      hasMessage: !!update.message,
      hasCallbackQuery: !!update.callback_query,
    });

    const result = await handleUpdate(update);

    if (result.success) {
      logInfo("Update processed successfully", { result });
    } else {
      logError("Update processing failed", { error: result.error });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: "OK",
        result: result.success ? "success" : "error",
        message: result.message || result.error,
      }),
    };
  } catch (error) {
    logError("Error processing webhook", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
