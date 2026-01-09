#!/usr/bin/env node

/**
 * Test script for auto poll functionality
 * Tests poll text generation, scheduler logic, and auto poll commands
 */

const { config } = require("dotenv");
const {
  generatePollContent,
} = require("./dist/src/utils/pollTextGenerator");
const {
  calculatePollSendTime,
  shouldSendPoll,
  shouldSendNotification,
  hasTheme,
  isEventMissing,
} = require("./dist/src/utils/pollScheduler");
const {
  executeAutoPollForEvent,
  sendPollNotification,
} = require("./dist/src/commands/autoPollCommand");
const {
  getYouthEventsForDateRange,
} = require("./dist/src/services/notionService");

// Load environment variables
config();

// Test configuration
const TEST_USER_ID = 282850458; // Replace with your test user ID

/**
 * Test poll text generation
 */
async function testPollTextGeneration() {
  console.log("🧪 Testing poll text generation...");

  try {
    // Test youth service event with theme
    const youthEventWithTheme = {
      id: "test-1",
      title: "Молодежное служение",
      date: new Date("2026-01-10T19:00:00"),
      theme: "Что такое церковь?",
      type: "event",
      serviceType: "Молодежное",
    };

    const result1 = generatePollContent(youthEventWithTheme);
    console.log("✅ Youth event with theme:");
    console.log("   Question:", result1.question);
    console.log("   Options:", result1.options);

    // Test youth service event without theme
    const youthEventWithoutTheme = {
      id: "test-2",
      title: "Молодежное служение",
      date: new Date("2026-01-10T19:00:00"),
      type: "event",
      serviceType: "Молодежное",
    };

    const result2 = generatePollContent(youthEventWithoutTheme);
    console.log("✅ Youth event without theme:");
    console.log("   Question:", result2.question);
    console.log("   Options:", result2.options);

    // Test МОСТ event
    const mostEvent = {
      id: "test-3",
      title: "Молодежное общение МОСТ",
      date: new Date("2026-01-10T19:30:00"),
      type: "event",
      serviceType: "МОСТ",
    };

    const result3 = generatePollContent(mostEvent);
    console.log("✅ МОСТ event:");
    console.log("   Question:", result3.question);
    console.log("   Options:", result3.options);

    console.log("✅ Poll text generation test PASSED");
  } catch (error) {
    console.log("❌ Poll text generation test FAILED");
    console.error("🚨 Error:", error);
  }
}

/**
 * Test poll scheduler logic
 */
async function testPollScheduler() {
  console.log("\n🧪 Testing poll scheduler logic...");

  try {
    // Test event tomorrow at 19:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0);

    const sendTime = calculatePollSendTime(tomorrow);
    console.log("✅ Calculated poll send time:");
    console.log("   Event date:", tomorrow.toISOString());
    console.log("   Send time:", sendTime.toISOString());
    console.log("   Send hour:", sendTime.getHours());
    console.log("   Send minute:", sendTime.getMinutes());

    // Test shouldSendPoll
    const now = new Date();
    const shouldSend = shouldSendPoll(tomorrow, now);
    console.log("✅ Should send poll check:");
    console.log("   Should send:", shouldSend);
    console.log("   Current time:", now.toISOString());

    // Test shouldSendNotification (3 hours before)
    const eventIn3Hours = new Date();
    eventIn3Hours.setHours(eventIn3Hours.getHours() + 3);
    const shouldNotify = shouldSendNotification(eventIn3Hours, now);
    console.log("✅ Should send notification check:");
    console.log("   Event in 3 hours:", eventIn3Hours.toISOString());
    console.log("   Should notify:", shouldNotify);

    // Test hasTheme
    const eventWithTheme = { theme: "Test theme" };
    const eventWithoutTheme = {};
    console.log("✅ Theme check:");
    console.log("   Event with theme:", hasTheme(eventWithTheme));
    console.log("   Event without theme:", hasTheme(eventWithoutTheme));
    console.log("   Null event:", isEventMissing(null));

    console.log("✅ Poll scheduler test PASSED");
  } catch (error) {
    console.log("❌ Poll scheduler test FAILED");
    console.error("🚨 Error:", error);
  }
}

/**
 * Test getting events from Notion
 */
async function testGetEvents() {
  console.log("\n🧪 Testing get events from Notion...");

  try {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 7); // Next 7 days

    const events = await getYouthEventsForDateRange(now, endDate, [
      "Молодежное",
      "МОСТ",
    ]);

    console.log("✅ Found events:", events.length);
    events.forEach((event, index) => {
      console.log(`   Event ${index + 1}:`);
      console.log("     ID:", event.id);
      console.log("     Title:", event.title);
      console.log("     Date:", event.date.toISOString());
      console.log("     Service Type:", event.serviceType);
      console.log("     Theme:", event.theme || "(no theme)");
    });

    console.log("✅ Get events test PASSED");
  } catch (error) {
    console.log("❌ Get events test FAILED");
    console.error("🚨 Error:", error);
  }
}

/**
 * Test auto poll command (dry run - doesn't actually send)
 */
async function testAutoPollCommand() {
  console.log("\n🧪 Testing auto poll command...");

  try {
    // Get a real event from Notion
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 7);

    const events = await getYouthEventsForDateRange(now, endDate, [
      "Молодежное",
      "МОСТ",
    ]);

    if (events.length === 0) {
      console.log("ℹ️  No events found for testing");
      return;
    }

    const testEvent = events[0];
    console.log("📋 Testing with event:", testEvent.title);

    // Test poll content generation
    const pollContent = generatePollContent(testEvent);
    console.log("✅ Generated poll content:");
    console.log("   Question:", pollContent.question);
    console.log("   Options:", pollContent.options);

    // Test send time calculation
    const sendTime = calculatePollSendTime(testEvent.date);
    console.log("✅ Calculated send time:", sendTime.toISOString());

    // Note: We don't actually send the poll in this test
    // Uncomment the line below to actually send (use with caution!)
    // const result = await executeAutoPollForEvent(testEvent);
    // console.log("📤 Poll send result:", result);

    console.log("✅ Auto poll command test PASSED");
  } catch (error) {
    console.log("❌ Auto poll command test FAILED");
    console.error("🚨 Error:", error);
  }
}

/**
 * Test notification sending
 */
async function testNotificationSending() {
  console.log("\n🧪 Testing notification sending...");

  try {
    // Get a real event from Notion
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 7);

    const events = await getYouthEventsForDateRange(now, endDate, [
      "Молодежное",
      "МОСТ",
    ]);

    if (events.length === 0) {
      console.log("ℹ️  No events found for testing");
      return;
    }

    const testEvent = events[0];
    console.log("📋 Testing notification for event:", testEvent.title);

    // Test with real event
    const result1 = await sendPollNotification(testEvent, testEvent.date);
    console.log("✅ Notification with event result:", result1.success);
    if (result1.error) {
      console.log("   Error:", result1.error);
    }

    // Test with missing event
    const result2 = await sendPollNotification(null, new Date());
    console.log("✅ Notification for missing event result:", result2.success);
    if (result2.error) {
      console.log("   Error:", result2.error);
    }

    console.log("✅ Notification sending test PASSED");
  } catch (error) {
    console.log("❌ Notification sending test FAILED");
    console.error("🚨 Error:", error);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("🚀 Starting Auto Poll Tests\n");

  // Build first
  console.log("📦 Building project...");
  const { execSync } = require("child_process");
  try {
    execSync("yarn build", { stdio: "inherit" });
    console.log("✅ Build completed\n");
  } catch (error) {
    console.error("❌ Build failed");
    process.exit(1);
  }

  await testPollTextGeneration();
  await testPollScheduler();
  await testGetEvents();
  await testAutoPollCommand();
  await testNotificationSending();

  console.log("\n🏁 Auto Poll Tests Completed");
}

// Run tests if called directly
if (require.main === module) {
  const command = process.argv[2];

  if (command === "text") {
    testPollTextGeneration().catch(console.error);
  } else if (command === "scheduler") {
    testPollScheduler().catch(console.error);
  } else if (command === "events") {
    testGetEvents().catch(console.error);
  } else if (command === "poll") {
    testAutoPollCommand().catch(console.error);
  } else if (command === "notification") {
    testNotificationSending().catch(console.error);
  } else {
    runTests().catch(console.error);
  }
}

module.exports = {
  testPollTextGeneration,
  testPollScheduler,
  testGetEvents,
  testAutoPollCommand,
  testNotificationSending,
};




