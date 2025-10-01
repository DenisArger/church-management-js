import { validateEnvironment } from "./config/environment";
import { setLoggerConfig, logInfo, logError } from "./utils/logger";
import { getAppConfig } from "./config/environment";

const initializeApp = (): void => {
  try {
    // Validate environment
    validateEnvironment();

    // Configure logger
    const appConfig = getAppConfig();
    setLoggerConfig({
      level: appConfig.logLevel as any,
      format: appConfig.logFormat as any,
    });

    logInfo("Church Telegram Bot initialized successfully", {
      nodeEnv: appConfig.nodeEnv,
      logLevel: appConfig.logLevel,
    });
  } catch (error) {
    logError("Failed to initialize app", error);
    process.exit(1);
  }
};

// Initialize app
initializeApp();

// Export for testing
export { initializeApp };
