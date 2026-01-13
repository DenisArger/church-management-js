#!/usr/bin/env node

/**
 * Test script for МОСТ and youth service poll functionality
 * Tests poll sending with DEBUG configuration
 */

const { config } = require("dotenv");
const {
  executeAutoPollForEvent,
} = require("./dist/src/commands/autoPollCommand");
const { getAppConfig, getTelegramConfig } = require("./dist/src/config/environment");
const { getTelegramConfigForMode } = require("./dist/src/services/telegramService");
const { generatePollContent } = require("./dist/src/utils/pollTextGenerator");
const {
  getYouthEventForTomorrow,
  getYouthEventsForDateRange,
} = require("./dist/src/services/notionService");

// Load environment variables
config();

/**
 * Test МОСТ poll with real Notion data
 */
async function testMostPoll() {
  console.log("🧪 Testing МОСТ poll with real Notion data...");

  try {
    // Get МОСТ events from Notion for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    console.log("🔍 Searching for МОСТ events in Notion...");
    console.log("📅 Date range:", {
      from: tomorrow.toISOString().split("T")[0],
      to: dayAfterTomorrow.toISOString().split("T")[0],
    });

    const events = await getYouthEventsForDateRange(
      tomorrow,
      dayAfterTomorrow,
      ["МОСТ"]
    );

    if (events.length === 0) {
      console.log("⚠️  No МОСТ events found in Notion for tomorrow");
      console.log("💡 Please create a МОСТ event in Notion calendar for tomorrow");
      console.log("   Event should have:");
      console.log("   - Date: tomorrow");
      console.log("   - Тип служения: МОСТ");
      return;
    }

    console.log(`✅ Found ${events.length} МОСТ event(s)`);

    // Use the first МОСТ event
    const mostEvent = events[0];
    console.log("📅 Using event:", {
      id: mostEvent.id,
      title: mostEvent.title,
      serviceType: mostEvent.serviceType,
      date: mostEvent.date.toISOString(),
      theme: mostEvent.theme,
    });

    // Generate poll content
    const pollContent = generatePollContent(mostEvent);
    console.log("📝 Generated poll content:", pollContent);

    // Execute poll
    const result = await executeAutoPollForEvent(mostEvent);

    if (result.success) {
      console.log("✅ МОСТ poll test PASSED");
      console.log("📝 Message:", result.message);
      if (result.data) {
        console.log("📊 Data:", JSON.stringify(result.data, null, 2));
      }
    } else {
      console.log("❌ МОСТ poll test FAILED");
      console.log("🚨 Error:", result.error);
    }
  } catch (error) {
    console.log("💥 МОСТ poll test ERROR");
    console.error("🚨 Error:", error);
  }
}

/**
 * Test youth service poll with real Notion data
 */
async function testYouthServicePoll() {
  console.log("🧪 Testing youth service poll with real Notion data...");

  try {
    // Get youth event from Notion for tomorrow
    console.log("🔍 Searching for youth event in Notion for tomorrow...");
    const youthEvent = await getYouthEventForTomorrow();

    if (!youthEvent) {
      console.log("⚠️  No youth event found in Notion for tomorrow");
      console.log("💡 Please create a youth event in Notion calendar for tomorrow");
      console.log("   Event should have:");
      console.log("   - Date: tomorrow");
      console.log("   - Тип служения: Молодежное");
      console.log("   - Название служения: (any title)");
      console.log("   - Тема: (optional, but recommended)");
      return;
    }

    console.log("📅 Using event:", {
      id: youthEvent.id,
      title: youthEvent.title,
      serviceType: youthEvent.serviceType,
      date: youthEvent.date.toISOString(),
      theme: youthEvent.theme,
      description: youthEvent.description,
    });

    // Generate poll content
    const pollContent = generatePollContent(youthEvent);
    console.log("📝 Generated poll content:", pollContent);

    // Execute poll
    const result = await executeAutoPollForEvent(youthEvent);

    if (result.success) {
      console.log("✅ Youth service poll test PASSED");
      console.log("📝 Message:", result.message);
      if (result.data) {
        console.log("📊 Data:", JSON.stringify(result.data, null, 2));
      }
    } else {
      console.log("❌ Youth service poll test FAILED");
      console.log("🚨 Error:", result.error);
    }
  } catch (error) {
    console.log("💥 Youth service poll test ERROR");
    console.error("🚨 Error:", error);
  }
}

/**
 * Test environment configuration
 */
function testEnvironment() {
  console.log("🧪 Testing environment configuration...");

  const appConfig = getAppConfig();
  const telegramConfig = getTelegramConfig();
  const telegramConfigForMode = getTelegramConfigForMode(appConfig.debug);

  console.log("🔧 App Config:", {
    nodeEnv: appConfig.nodeEnv,
    debug: appConfig.debug,
    logLevel: appConfig.logLevel,
  });

  console.log("🔧 Telegram Config:", {
    hasDebugBotToken: !!telegramConfig.debugBotToken,
    debugChatId: telegramConfig.debugChatId,
    debugTopicId: telegramConfig.debugTopicId,
    hasMainBotToken: !!telegramConfig.botToken,
  });

  console.log("🔧 Telegram Config for Mode:", {
    chatId: telegramConfigForMode.chatId,
    topicId: telegramConfigForMode.topicId,
    isDebugBot: telegramConfigForMode.bot === require("./dist/src/services/telegramService").getDebugTelegramBot(),
  });

  const requiredVars = [
    "TELEGRAM_BOT_TOKEN_DEBUG",
    "TELEGRAM_CHAT_ID_DEBUG",
    "TELEGRAM_TOPIC_ID_DEBUG",
  ];

  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length === 0) {
    console.log("✅ All required environment variables are set");
  } else {
    console.log("❌ Missing environment variables:");
    missing.forEach((varName) => console.log(`   - ${varName}`));
  }
}

/**
 * Test Notion connection and list available events
 */
async function testNotionConnection() {
  console.log("🧪 Testing Notion connection and listing events...");

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    console.log("🔍 Searching for all youth events (МОСТ and Молодежное)...");
    console.log("📅 Date range:", {
      from: tomorrow.toISOString().split("T")[0],
      to: dayAfterTomorrow.toISOString().split("T")[0],
    });

    const events = await getYouthEventsForDateRange(
      tomorrow,
      dayAfterTomorrow,
      ["Молодежное", "МОСТ"]
    );

    if (events.length === 0) {
      console.log("⚠️  No youth events found in Notion for tomorrow");
      console.log("💡 Please create events in Notion calendar:");
      console.log("   1. МОСТ event:");
      console.log("      - Date: tomorrow");
      console.log("      - Тип служения: МОСТ");
      console.log("      - Название служения: (any title)");
      console.log("   2. Молодежное event:");
      console.log("      - Date: tomorrow");
      console.log("      - Тип служения: Молодежное");
      console.log("      - Название служения: (any title)");
      console.log("      - Тема: (optional, but recommended)");
    } else {
      console.log(`✅ Found ${events.length} event(s):`);
      events.forEach((event, index) => {
        console.log(`   ${index + 1}. ${event.serviceType || "Unknown"}: ${event.title}`);
        console.log(`      Date: ${event.date.toISOString()}`);
        console.log(`      Theme: ${event.theme || "(no theme)"}`);
        console.log(`      ID: ${event.id}`);
      });
    }
  } catch (error) {
    console.log("💥 Notion connection test ERROR");
    console.error("🚨 Error:", error);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("🚀 Starting МОСТ and Youth Service Poll Tests");
  console.log("=".repeat(50));

  // Test environment first
  testEnvironment();
  console.log();

  // Test Notion connection
  await testNotionConnection();
  console.log();

  // Test МОСТ poll
  await testMostPoll();
  console.log();

  // Test youth service poll
  await testYouthServicePoll();
  console.log();

  console.log("=".repeat(50));
  console.log("🏁 МОСТ and Youth Service Poll Tests Completed");
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  // Run all tests
  runTests().catch(console.error);
} else {
  const command = args[0];

  switch (command) {
    case "most":
      testMostPoll().catch(console.error);
      break;
    case "youth":
      testYouthServicePoll().catch(console.error);
      break;
    case "notion":
      testNotionConnection().catch(console.error);
      break;
    case "env":
      testEnvironment();
      break;
    case "help":
      console.log("МОСТ and Youth Service Poll Test Script");
      console.log();
      console.log("Usage:");
      console.log("  node test-most-youth-poll.js [command]");
      console.log();
      console.log("Commands:");
      console.log("  (no args)  - Run all tests");
      console.log("  most       - Test МОСТ poll (uses real Notion data)");
      console.log("  youth      - Test youth service poll (uses real Notion data)");
      console.log("  notion     - Test Notion connection and list events");
      console.log("  env        - Test environment configuration");
      console.log("  help       - Show this help");
      break;
    default:
      console.log(`Unknown command: ${command}`);
      console.log("Use 'help' for usage information");
      process.exit(1);
  }
}

