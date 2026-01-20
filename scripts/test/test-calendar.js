#!/usr/bin/env node

/**
 * Test script for calendar service after refactor (calendar/sundayService, weeklySchedule, debug).
 * Checks exports from calendarService facade and formatServiceInfo.
 * Optional: getSundayMeeting, getWeeklySchedule (require Notion; skip or tolerate errors).
 */

const { config } = require("dotenv");
const requireDist = require("./require-dist");

config();

const EXPECTED_EXPORTS = [
  "ITEM_TYPE_SUNDAY_1",
  "ITEM_TYPE_SUNDAY_2",
  "debugCalendarDatabase",
  "getSundayMeeting",
  "formatServiceInfo",
  "getSundayServiceByDate",
  "createSundayService",
  "updateSundayService",
  "getWorshipServices",
  "getScriptureReaders",
  "getWeeklySchedule",
  "getScheduleServiceById",
  "getScheduleServicesForWeek",
  "createScheduleService",
  "updateScheduleService",
];

function testExports() {
  console.log("🧪 Testing calendarService exports...");

  const cal = requireDist("services/calendarService");
  const missing = EXPECTED_EXPORTS.filter((n) => typeof cal[n] === "undefined");

  if (missing.length > 0) {
    console.log("❌ Missing exports:", missing.join(", "));
    return false;
  }
  console.log("✅ All", EXPECTED_EXPORTS.length, "exports present");
  return true;
}

function testConstants() {
  console.log("🧪 Testing ITEM_TYPE constants...");

  const { ITEM_TYPE_SUNDAY_1, ITEM_TYPE_SUNDAY_2 } = requireDist("services/calendarService");

  if (ITEM_TYPE_SUNDAY_1 !== "Воскресное-1" || ITEM_TYPE_SUNDAY_2 !== "Воскресное-2") {
    console.log("❌ ITEM_TYPE values:", { ITEM_TYPE_SUNDAY_1, ITEM_TYPE_SUNDAY_2 });
    return false;
  }
  console.log("✅ ITEM_TYPE_SUNDAY_1 =", ITEM_TYPE_SUNDAY_1, ", ITEM_TYPE_SUNDAY_2 =", ITEM_TYPE_SUNDAY_2);
  return true;
}

function testFormatServiceInfo() {
  console.log("🧪 Testing formatServiceInfo (pure, no Notion)...");

  const { formatServiceInfo, ITEM_TYPE_SUNDAY_1, ITEM_TYPE_SUNDAY_2 } = requireDist("services/calendarService");

  const mockInfo = {
    date: new Date("2026-01-12"),
    services: [
      {
        id: "t1",
        title: "I поток",
        date: new Date("2026-01-12T10:00:00"),
        type: ITEM_TYPE_SUNDAY_1,
        preachers: [{ name: "Иван Иванов" }],
        worshipService: "Хор",
        songBeforeStart: true,
        numWorshipSongs: 3,
        soloSong: false,
        repentanceSong: true,
        scriptureReading: "Рим. 1:1-7",
        scriptureReader: "Петр",
      },
    ],
  };

  const out = formatServiceInfo(mockInfo);
  if (typeof out !== "string" || out.length === 0) {
    console.log("❌ formatServiceInfo returned:", typeof out, out);
    return false;
  }
  if (!out.includes("Иван Иванов") || !out.includes("I поток") || !out.includes("Хор") || !out.includes("Рим. 1:1-7")) {
    console.log("❌ formatServiceInfo missing expected snippets. Sample:", out.slice(0, 200));
    return false;
  }
  console.log("✅ formatServiceInfo OK, length:", out.length);
  return true;
}

async function testGetSundayMeeting() {
  console.log("🧪 Testing getSundayMeeting (Notion; may skip if env missing)...");

  const { getSundayMeeting } = requireDist("services/calendarService");

  try {
    const r = await getSundayMeeting();
    console.log("✅ getSundayMeeting OK, result:", r === null ? "null" : "SundayServiceInfo");
    return true;
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    if (/NOTION|database|Unauthorized|404|ENOTFOUND/.test(msg) || !process.env.NOTION_TOKEN) {
      console.log("ℹ️  getSundayMeeting skipped (Notion/env):", msg.slice(0, 80));
      return true;
    }
    console.log("❌ getSundayMeeting error:", msg);
    return false;
  }
}

async function testGetWeeklySchedule() {
  console.log("🧪 Testing getWeeklySchedule (Notion; may skip if env missing)...");

  const { getWeeklySchedule } = requireDist("services/calendarService");

  try {
    const r = await getWeeklySchedule("next");
    console.log("✅ getWeeklySchedule OK, result:", r === null ? "null" : "WeeklyScheduleInfo");
    return true;
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    if (/NOTION|database|Unauthorized|404|ENOTFOUND/.test(msg) || !process.env.NOTION_TOKEN) {
      console.log("ℹ️  getWeeklySchedule skipped (Notion/env):", msg.slice(0, 80));
      return true;
    }
    console.log("❌ getWeeklySchedule error:", msg);
    return false;
  }
}

async function runTests() {
  console.log("🚀 Calendar service tests (post-refactor)\n");

  const { execSync } = require("child_process");
  try {
    execSync("yarn build", { stdio: "inherit" });
  } catch (e) {
    console.error("❌ Build failed");
    process.exit(1);
  }

  let ok = true;
  ok = testExports() && ok;
  ok = testConstants() && ok;
  ok = testFormatServiceInfo() && ok;
  await testGetSundayMeeting().then((r) => { ok = r && ok; });
  await testGetWeeklySchedule().then((r) => { ok = r && ok; });

  console.log(ok ? "\n✅ Calendar tests PASSED" : "\n❌ Calendar tests FAILED");
  process.exit(ok ? 0 : 1);
}

const cmd = process.argv[2];
if (cmd === "exports") {
  require("child_process").execSync("yarn build", { stdio: "inherit" });
  process.exit(testExports() && testConstants() ? 0 : 1);
} else if (cmd === "format") {
  require("child_process").execSync("yarn build", { stdio: "inherit" });
  process.exit(testFormatServiceInfo() ? 0 : 1);
} else {
  runTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
