#!/usr/bin/env node

/**
 * Test script for youth poll functionality
 * Tests both manual command execution and scheduled execution
 */

const { config } = require("dotenv");
const {
  executeYouthPollCommand,
  executeYouthPollScheduled,
} = require("./dist/src/commands/youthPollCommand");
const {
  getYouthEventForTomorrow,
} = require("./dist/src/services/notionService");
const { logInfo, logError } = require("./dist/src/utils/logger");

// Load environment variables
config();

// Test configuration
const TEST_USER_ID = 123456789; // Replace with your test user ID
const TEST_CHAT_ID = -1002317620302; // Replace with your test chat ID

/**
 * Test manual youth poll command
 */
async function testManualYouthPoll() {
  console.log("🧪 Testing manual youth poll command...");

  try {
    const result = await executeYouthPollCommand(TEST_USER_ID, TEST_CHAT_ID);

    if (result.success) {
      console.log("✅ Manual youth poll test PASSED");
      console.log("📝 Message:", result.message);
      if (result.data) {
        console.log("📊 Data:", JSON.stringify(result.data, null, 2));
      }
    } else {
      console.log("❌ Manual youth poll test FAILED");
      console.log("🚨 Error:", result.error);
    }
  } catch (error) {
    console.log("💥 Manual youth poll test ERROR");
    console.error("🚨 Error:", error);
  }
}

/**
 * Test scheduled youth poll execution
 */
async function testScheduledYouthPoll() {
  console.log("🧪 Testing scheduled youth poll execution...");

  try {
    const result = await executeYouthPollScheduled();

    if (result.success) {
      console.log("✅ Scheduled youth poll test PASSED");
      console.log("📝 Message:", result.message);
      if (result.data) {
        console.log("📊 Data:", JSON.stringify(result.data, null, 2));
      }
    } else {
      console.log("❌ Scheduled youth poll test FAILED");
      console.log("🚨 Error:", result.error);
    }
  } catch (error) {
    console.log("💥 Scheduled youth poll test ERROR");
    console.error("🚨 Error:", error);
  }
}

/**
 * Test Notion service directly
 */
async function testNotionService() {
  console.log("🧪 Testing Notion service for youth events...");

  try {
    const youthEvent = await getYouthEventForTomorrow();

    if (youthEvent) {
      console.log("✅ Youth event found for tomorrow");
      console.log("📅 Event details:");
      console.log("   ID:", youthEvent.id);
      console.log("   Title:", youthEvent.title);
      console.log("   Date:", youthEvent.date.toISOString());
      console.log("   Description:", youthEvent.description);
      console.log("   Theme:", youthEvent.theme);
      console.log("   Type:", youthEvent.type);
    } else {
      console.log("ℹ️  No youth event found for tomorrow");
      console.log("💡 This is normal if there's no youth event scheduled");
    }
  } catch (error) {
    console.log("💥 Notion service test ERROR");
    console.error("🚨 Error:", error);
  }
}

/**
 * Test environment configuration
 */
function testEnvironment() {
  console.log("🧪 Testing environment configuration...");

  const requiredVars = [
    "TELEGRAM_BOT_TOKEN_DEBUG",
    "TELEGRAM_CHAT_ID_DEBUG",
    "TELEGRAM_TOPIC_ID_DEBUG",
    "NOTION_TOKEN",
    "NOTION_GENERAL_CALENDAR_DATABASE",
  ];

  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length === 0) {
    console.log("✅ All required environment variables are set");
    console.log("🔧 Configuration:");
    console.log(
      "   Debug Bot Token:",
      process.env.TELEGRAM_BOT_TOKEN_DEBUG ? "✅ Set" : "❌ Missing"
    );
    console.log(
      "   Debug Chat ID:",
      process.env.TELEGRAM_CHAT_ID_DEBUG || "❌ Missing"
    );
    console.log(
      "   Debug Topic ID:",
      process.env.TELEGRAM_TOPIC_ID_DEBUG || "❌ Missing"
    );
    console.log(
      "   Notion Token:",
      process.env.NOTION_TOKEN ? "✅ Set" : "❌ Missing"
    );
    console.log(
      "   Calendar Database:",
      process.env.NOTION_GENERAL_CALENDAR_DATABASE ? "✅ Set" : "❌ Missing"
    );
  } else {
    console.log("❌ Missing environment variables:");
    missing.forEach((varName) => console.log(`   - ${varName}`));
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("🚀 Starting Youth Poll Tests");
  console.log("=".repeat(50));

  // Test environment first
  testEnvironment();
  console.log();

  // Test Notion service
  await testNotionService();
  console.log();

  // Test manual command
  await testManualYouthPoll();
  console.log();

  // Test scheduled execution
  await testScheduledYouthPoll();
  console.log();

  console.log("=".repeat(50));
  console.log("🏁 Youth Poll Tests Completed");
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  // Run all tests
  runTests().catch(console.error);
} else {
  const command = args[0];

  switch (command) {
    case "manual":
      testManualYouthPoll().catch(console.error);
      break;
    case "scheduled":
      testScheduledYouthPoll().catch(console.error);
      break;
    case "notion":
      testNotionService().catch(console.error);
      break;
    case "env":
      testEnvironment();
      break;
    case "help":
      console.log("Youth Poll Test Script");
      console.log();
      console.log("Usage:");
      console.log("  node test-youth-poll.js [command]");
      console.log();
      console.log("Commands:");
      console.log("  (no args)  - Run all tests");
      console.log("  manual     - Test manual youth poll command");
      console.log("  scheduled  - Test scheduled youth poll execution");
      console.log("  notion     - Test Notion service for youth events");
      console.log("  env        - Test environment configuration");
      console.log("  help       - Show this help");
      break;
    default:
      console.log(`Unknown command: ${command}`);
      console.log("Use 'help' for usage information");
      process.exit(1);
  }
}
