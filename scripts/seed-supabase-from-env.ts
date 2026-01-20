import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env") });

const APP_CONFIG_KEYS = [
  "LOG_LEVEL",
  "LOG_FORMAT",
  "NODE_ENV",
  "DEBUG",
  "SUPABASE_LOGS_ENABLED",
  "TELEGRAM_YOUTH_GROUP_ID",
  "TELEGRAM_CHAT_ID_DEBUG",
  "TELEGRAM_TOPIC_ID_DEBUG",
] as const;

function parseAllowedUsers(s: string): number[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .map(Number)
    .filter((n) => !isNaN(n));
}

function parseYouthLeaderMapping(s: string): Array<{ telegram_id: number; name: string }> {
  const out: Array<{ telegram_id: number; name: string }> = [];
  const mappings = s.split(",").map((m) => m.trim());
  for (const mappingStr of mappings) {
    const parts = mappingStr.split(":").map((t) => t.trim());
    const idStr = parts[0];
    const name = parts.slice(1).join(":").trim();
    const id = parseInt(idStr, 10);
    if (!isNaN(id) && name) {
      out.push({ telegram_id: id, name });
    }
  }
  return out;
}

async function run(dryRun: boolean): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required in .env");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // 1. app_config
  for (const k of APP_CONFIG_KEYS) {
    if (process.env[k] !== undefined) {
      const val = process.env[k] ?? "";
      if (dryRun) {
        console.log("[dry-run] app_config upsert", k, "=", val);
      } else {
        const { error } = await supabase
          .from("app_config")
          .upsert(
            { key: k, value: val, updated_at: new Date().toISOString() },
            { onConflict: "key" }
          );
        if (error) throw error;
        console.log("app_config upsert", k);
      }
    }
  }

  // 2. allowed_users
  const allowedStr = process.env.ALLOWED_USERS;
  if (allowedStr !== undefined) {
    const ids = parseAllowedUsers(allowedStr);
    if (dryRun) {
      console.log("[dry-run] allowed_users replace:", ids);
    } else {
      const { data: existing } = await supabase.from("allowed_users").select("telegram_id");
      const existingIds = (existing ?? []).map((r) => r.telegram_id);
      if (existingIds.length > 0) {
        const { error: delErr } = await supabase
          .from("allowed_users")
          .delete()
          .in("telegram_id", existingIds);
        if (delErr) throw delErr;
      }
      if (ids.length > 0) {
        const { error: insErr } = await supabase
          .from("allowed_users")
          .insert(ids.map((telegram_id) => ({ telegram_id, role: null })));
        if (insErr) throw insErr;
        console.log("allowed_users insert", ids.length, "rows");
      } else {
        console.log("allowed_users cleared (empty list in .env)");
      }
    }
  }

  // 3. youth_leaders
  const youthStr = process.env.YOUTH_LEADER_MAPPING;
  if (youthStr !== undefined) {
    const entries = parseYouthLeaderMapping(youthStr);
    if (dryRun) {
      console.log("[dry-run] youth_leaders replace:", entries);
    } else {
      const { data: existing } = await supabase.from("youth_leaders").select("telegram_id");
      const existingIds = (existing ?? []).map((r) => r.telegram_id);
      if (existingIds.length > 0) {
        const { error: delErr } = await supabase
          .from("youth_leaders")
          .delete()
          .in("telegram_id", existingIds);
        if (delErr) throw delErr;
      }
      if (entries.length > 0) {
        const { error: insErr } = await supabase
          .from("youth_leaders")
          .insert(entries.map((e) => ({ telegram_id: e.telegram_id, name: e.name, is_active: true })));
        if (insErr) throw insErr;
        console.log("youth_leaders insert", entries.length, "rows");
      } else {
        console.log("youth_leaders cleared (empty or invalid YOUTH_LEADER_MAPPING in .env)");
      }
    }
  }

  console.log("Done.");
}

run(process.argv.includes("--dry-run")).catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

