#!/usr/bin/env node

/**
 * Test script for МОСТ and youth service poll functionality
 * Tests poll sending with DEBUG configuration
 */

const { config } = require("dotenv");
const requireDist = require("./require-dist");
const {
  executeAutoPollForEvent,
  sendPollNotification,
} = requireDist("commands/autoPollCommand");
const { getAppConfig, getTelegramConfig } = requireDist("config/environment");
const { getTelegramConfigForMode } = requireDist("services/telegramService");
const { generatePollContent } = requireDist("utils/pollTextGenerator");
const {
  getYouthEventForTomorrow,
  getYouthEventsForDateRange,
} = requireDist("services/notionService");
const {
  calculatePollSendTime,
  shouldSendPoll,
  shouldSendNotification,
} = requireDist("utils/pollScheduler");

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
    isDebugBot: telegramConfigForMode.bot === requireDist("services/telegramService").getDebugTelegramBot(),
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
 * Test poll notification (warning about missing theme/time)
 */
async function testPollNotification() {
  console.log("🧪 Testing poll notification (theme and time check)...");

  try {
    // Get youth event from Notion for tomorrow
    console.log("🔍 Searching for youth event in Notion for tomorrow...");
    const youthEvent = await getYouthEventForTomorrow();

    if (!youthEvent) {
      console.log("⚠️  No youth event found in Notion for tomorrow");
      console.log("💡 Please create a youth event in Notion calendar for tomorrow");
      return;
    }

    const hasTheme = !!youthEvent.theme && youthEvent.theme.trim().length > 0;
    const hasTime = youthEvent.date.getUTCHours() !== 0 || 
                    youthEvent.date.getUTCMinutes() !== 0 || 
                    youthEvent.date.getUTCSeconds() !== 0;

    console.log("📅 Using event:", {
      id: youthEvent.id,
      title: youthEvent.title,
      serviceType: youthEvent.serviceType,
      date: youthEvent.date.toISOString(),
      theme: youthEvent.theme || "(no theme)",
      hasTheme: hasTheme,
      hasTime: hasTime,
    });

    // Test notification with real event
    console.log("\n📤 Testing notification with real event...");
    const result = await sendPollNotification(youthEvent, youthEvent.date);

    if (result.success) {
      console.log("✅ Poll notification test PASSED");
      console.log("📝 Message sent to administrator");
      
      if (hasTheme && hasTime) {
        console.log("ℹ️  Event has both theme and time - normal reminder sent");
      } else {
        console.log("⚠️  Event missing theme or time - warning message sent");
      }
    } else {
      console.log("❌ Poll notification test FAILED");
      console.log("🚨 Error:", result.error);
    }

    // Test with modified event (without theme) to test warning
    console.log("\n📤 Testing notification with event WITHOUT theme...");
    const eventWithoutTheme = {
      ...youthEvent,
      theme: "",
    };
    const resultNoTheme = await sendPollNotification(eventWithoutTheme, eventWithoutTheme.date);
    
    if (resultNoTheme.success) {
      console.log("✅ Warning notification (no theme) test PASSED");
    } else {
      console.log("❌ Warning notification (no theme) test FAILED");
      console.log("🚨 Error:", resultNoTheme.error);
    }

    // Test with modified event (without time) to test warning
    console.log("\n📤 Testing notification with event WITHOUT time...");
    const dateWithoutTime = new Date(youthEvent.date);
    dateWithoutTime.setUTCHours(0, 0, 0, 0);
    const eventWithoutTime = {
      ...youthEvent,
      date: dateWithoutTime,
    };
    const resultNoTime = await sendPollNotification(eventWithoutTime, eventWithoutTime.date);
    
    if (resultNoTime.success) {
      console.log("✅ Warning notification (no time) test PASSED");
    } else {
      console.log("❌ Warning notification (no time) test FAILED");
      console.log("🚨 Error:", resultNoTime.error);
    }

    // Test with modified event (without theme and time) to test warning
    console.log("\n📤 Testing notification with event WITHOUT theme AND time...");
    const dateWithoutTime2 = new Date(youthEvent.date);
    dateWithoutTime2.setUTCHours(0, 0, 0, 0);
    const eventWithoutBoth = {
      ...youthEvent,
      theme: "",
      date: dateWithoutTime2,
    };
    const resultNoBoth = await sendPollNotification(eventWithoutBoth, eventWithoutBoth.date);
    
    if (resultNoBoth.success) {
      console.log("✅ Warning notification (no theme and time) test PASSED");
    } else {
      console.log("❌ Warning notification (no theme and time) test FAILED");
      console.log("🚨 Error:", resultNoBoth.error);
    }
  } catch (error) {
    console.log("💥 Poll notification test ERROR");
    console.error("🚨 Error:", error);
  }
}

/**
 * Test poll and notification timing
 */
async function testPollTiming() {
  console.log("🧪 Testing poll and notification timing...");

  try {
    // Get youth event from Notion for tomorrow
    const youthEvent = await getYouthEventForTomorrow();

    if (!youthEvent) {
      console.log("⚠️  No youth event found in Notion for tomorrow");
      console.log("💡 Please create a youth event in Notion calendar for tomorrow");
      return;
    }

    const eventDate = youthEvent.date;
    const now = new Date();

    console.log("📅 Event details:", {
      title: youthEvent.title,
      eventDate: eventDate.toISOString(),
      eventDateLocal: eventDate.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }),
      currentTime: now.toISOString(),
      currentTimeLocal: now.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }),
    });

    // Test calculatePollSendTime
    console.log("\n⏰ Testing calculatePollSendTime...");
    const pollSendTime = calculatePollSendTime(eventDate);
    // Calculate time difference
    const timeDiffMs = eventDate.getTime() - pollSendTime.getTime();
    const hoursBeforeEvent = timeDiffMs / (1000 * 60 * 60);
    
    console.log("📊 Calculated poll send time:", {
      sendTime: pollSendTime.toISOString(),
      sendTimeLocal: pollSendTime.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }),
      eventDateLocal: eventDate.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }),
      hoursBeforeEvent: hoursBeforeEvent.toFixed(2),
      note: hoursBeforeEvent !== 24 ? "⚠️  Note: Difference may be 25 hours in UTC due to timezone, but should be ~24 hours in Moscow time" : "",
    });

    // Test shouldSendPoll with different times
    console.log("\n📤 Testing shouldSendPoll with different times...");
    
    // Test 1: Current time (should be false if not in window)
    const shouldSendNow = shouldSendPoll(eventDate, now);
    console.log(`   Current time: ${shouldSendNow ? "✅ Should send" : "❌ Should NOT send"}`);

    // Test 2: Exactly at send time
    const atSendTime = new Date(pollSendTime);
    const shouldSendAtTime = shouldSendPoll(eventDate, atSendTime);
    console.log(`   At send time (${atSendTime.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}): ${shouldSendAtTime ? "✅ Should send" : "❌ Should NOT send"}`);

    // Test 3: 2 minutes after send time (within 2 minute window)
    const twoMinutesAfter = new Date(pollSendTime);
    twoMinutesAfter.setMinutes(twoMinutesAfter.getMinutes() + 2);
    const shouldSend2MinAfter = shouldSendPoll(eventDate, twoMinutesAfter);
    console.log(`   2 minutes after send time: ${shouldSend2MinAfter ? "✅ Should send" : "❌ Should NOT send"}`);

    // Test 4: 3 minutes after send time (outside 2 minute window)
    const threeMinutesAfter = new Date(pollSendTime);
    threeMinutesAfter.setMinutes(threeMinutesAfter.getMinutes() + 3);
    const shouldSend3MinAfter = shouldSendPoll(eventDate, threeMinutesAfter);
    console.log(`   3 minutes after send time: ${shouldSend3MinAfter ? "✅ Should send" : "❌ Should NOT send"}`);
    
    // Test 5: Verify poll time matches event time
    const eventTimeLocal = eventDate.toLocaleString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" });
    const pollTimeLocal = pollSendTime.toLocaleString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" });
    const timesMatch = eventTimeLocal === pollTimeLocal;
    console.log(`   Poll time matches event time (${eventTimeLocal} → ${pollTimeLocal}): ${timesMatch ? "✅ Match" : "❌ Mismatch"}`);

    // Test 6: 1 hour before send time (too early)
    const oneHourBefore = new Date(pollSendTime);
    oneHourBefore.setHours(oneHourBefore.getHours() - 1);
    const shouldSend1HourBefore = shouldSendPoll(eventDate, oneHourBefore);
    console.log(`   1 hour before send time: ${shouldSend1HourBefore ? "✅ Should send" : "❌ Should NOT send"}`);

    // Test shouldSendNotification
    console.log("\n📬 Testing shouldSendNotification with different times...");
    
    // Calculate notification time (3 hours before event)
    const threeHoursBefore = new Date(eventDate);
    threeHoursBefore.setHours(threeHoursBefore.getHours() - 3);
    const tenMinutesAfter = new Date(threeHoursBefore);
    tenMinutesAfter.setMinutes(tenMinutesAfter.getMinutes() + 10);

    console.log("📊 Notification timing:", {
      notificationTime: threeHoursBefore.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }),
      windowEnd: tenMinutesAfter.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }),
      hoursBeforeEvent: 3,
      windowDuration: "10 minutes",
    });

    // Test 1: Current time
    const shouldNotifyNow = shouldSendNotification(eventDate, now);
    console.log(`   Current time: ${shouldNotifyNow ? "✅ Should send notification" : "❌ Should NOT send notification"}`);

    // Test 2: Exactly at 3 hours before event
    const shouldNotifyAtTime = shouldSendNotification(eventDate, threeHoursBefore);
    console.log(`   At notification time (3h before): ${shouldNotifyAtTime ? "✅ Should send notification" : "❌ Should NOT send notification"}`);

    // Test 3: 5 minutes after 3 hours before event (within 10 minute window)
    const fiveMinutesAfter = new Date(threeHoursBefore);
    fiveMinutesAfter.setMinutes(fiveMinutesAfter.getMinutes() + 5);
    const shouldNotify5MinAfter = shouldSendNotification(eventDate, fiveMinutesAfter);
    console.log(`   5 minutes after (3h before): ${shouldNotify5MinAfter ? "✅ Should send notification" : "❌ Should NOT send notification"}`);

    // Test 4: 10 minutes after 3 hours before event (at window end)
    const shouldNotify10MinAfter = shouldSendNotification(eventDate, tenMinutesAfter);
    console.log(`   10 minutes after (3h before): ${shouldNotify10MinAfter ? "✅ Should send notification" : "❌ Should NOT send notification"}`);

    // Test 5: 11 minutes after 3 hours before event (outside window)
    const elevenMinutesAfter = new Date(threeHoursBefore);
    elevenMinutesAfter.setMinutes(elevenMinutesAfter.getMinutes() + 11);
    const shouldNotify11MinAfter = shouldSendNotification(eventDate, elevenMinutesAfter);
    console.log(`   11 minutes after (3h before): ${shouldNotify11MinAfter ? "✅ Should send notification" : "❌ Should NOT send notification"}`);

    // Test 6: Before notification time (3.5 hours before event)
    const beforeNotification = new Date(threeHoursBefore);
    beforeNotification.setHours(beforeNotification.getHours() - 0.5);
    const shouldNotifyBefore = shouldSendNotification(eventDate, beforeNotification);
    console.log(`   Before notification time (3.5h before): ${shouldNotifyBefore ? "✅ Should send notification" : "❌ Should NOT send notification"}`);

    console.log("\n✅ Poll timing tests completed");
  } catch (error) {
    console.log("💥 Poll timing test ERROR");
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

  // Test poll timing
  await testPollTiming();
  console.log();

  // Test poll notification
  await testPollNotification();
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
    case "notification":
      testPollNotification().catch(console.error);
      break;
    case "timing":
      testPollTiming().catch(console.error);
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
      console.log("  (no args)     - Run all tests");
      console.log("  most          - Test МОСТ poll (uses real Notion data)");
      console.log("  youth         - Test youth service poll (uses real Notion data)");
      console.log("  notification  - Test poll notification (theme and time check)");
      console.log("  timing        - Test poll and notification timing");
      console.log("  notion        - Test Notion connection and list events");
      console.log("  env           - Test environment configuration");
      console.log("  help          - Show this help");
      break;
    default:
      console.log(`Unknown command: ${command}`);
      console.log("Use 'help' for usage information");
      process.exit(1);
  }
}

