import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient | null | undefined = undefined;
let appConfigCache: Map<string, string> | null = null;
let allowedUsersCache: number[] | null = null;

function getClient(): SupabaseClient | null {
  if (supabase !== undefined) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    try {
      supabase = createClient(url, key);
    } catch {
      supabase = null;
    }
  } else {
    supabase = null;
  }
  return supabase;
}

export async function ensureAppConfigLoaded(): Promise<void> {
  if (appConfigCache !== null) return;
  const client = getClient();
  if (!client) {
    appConfigCache = appConfigCache ?? new Map();
    allowedUsersCache = allowedUsersCache ?? null;
    return;
  }
  try {
    const { data: configData, error: configError } = await client.from("app_config").select("key, value");
    if (!configError && configData) {
      appConfigCache = new Map(configData.map((r) => [r.key, r.value]));
    } else {
      appConfigCache = appConfigCache ?? new Map();
    }
  } catch {
    appConfigCache = appConfigCache ?? new Map();
  }
  try {
    const { data: usersData, error: usersError } = await client.from("allowed_users").select("telegram_id");
    if (!usersError && usersData && usersData.length > 0) {
      allowedUsersCache = usersData.map((r) => Number(r.telegram_id)).filter((n) => !isNaN(n));
    } else {
      allowedUsersCache = allowedUsersCache ?? null;
    }
  } catch {
    allowedUsersCache = allowedUsersCache ?? null;
  }
}

export function getAllowedUsers(): number[] | null {
  return allowedUsersCache;
}

export function getAppConfigValue(key: string): string | undefined {
  const fromCache = appConfigCache?.get(key);
  if (fromCache !== undefined) return fromCache;
  return process.env[key];
}

