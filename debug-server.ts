import express from "express";
import cors from "cors";
import { handleUpdate } from "./src/handlers/messageHandler";
import { validateEnvironment } from "./src/config/environment";
import { ensureAppConfigLoaded } from "./src/config/appConfigStore";
import { logInfo, logError } from "./src/utils/logger";

// Validate environment on startup
try {
  validateEnvironment();
  logInfo("Environment validation passed");
} catch (error) {
  logError("Environment validation failed", error);
}

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Webhook endpoint
app.post("/webhook", async (req, res) => {
  try {
    await ensureAppConfigLoaded();
    const update = req.body;
    logInfo("Received webhook update", {
      updateId: update.update_id,
      hasMessage: !!update.message,
      hasCallbackQuery: !!update.callback_query,
    });

    const result = await handleUpdate(update);

    if (result.success) {
      logInfo("Message processed successfully", { result });
    } else {
      logError("Message processing failed", { error: result.error });
    }

    res.json({
      status: "OK",
      result: result.success ? "success" : "error",
      message: result.message || result.error,
    });
  } catch (error) {
    logError("Error processing webhook", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Test endpoint
app.get("/test", (req, res) => {
  res.json({
    message: "Debug server is running",
    timestamp: new Date().toISOString(),
    port: PORT,
  });
});

app.listen(PORT, () => {
  logInfo(`Debug server running on port ${PORT}`);
  console.log(`🚀 Debug server started at http://localhost:${PORT}`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
});
