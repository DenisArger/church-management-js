import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null | undefined = undefined;

function getSupabase(): SupabaseClient | null {
  if (supabaseClient !== undefined) return supabaseClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    try {
      supabaseClient = createClient(url, key);
    } catch {
      supabaseClient = null;
    }
  } else {
    supabaseClient = null;
  }
  return supabaseClient;
}

const memory = new Map<string, Record<string, unknown>>();

const DATE_KEYS = ["date", "dateStart", "dateEnd"];

function reviveDataDates(obj: Record<string, unknown> | null): void {
  if (!obj || typeof obj !== "object" || !obj.data || typeof obj.data !== "object") return;
  const data = obj.data as Record<string, unknown>;
  for (const k of DATE_KEYS) {
    if (typeof data[k] === "string") {
      data[k] = new Date(data[k] as string);
    }
  }
}

export type StateType = "prayer" | "schedule" | "sunday_service" | "youth_report";

export async function getState(
  userId: number,
  stateType: StateType
): Promise<Record<string, unknown> | null> {
  const client = getSupabase();
  if (client) {
    const { data, error } = await client
      .from("user_form_state")
      .select("payload")
      .eq("user_id", userId)
      .eq("state_type", stateType)
      .maybeSingle();
    if (error) return null;
    const raw = (data?.payload as Record<string, unknown>) ?? null;
    if (raw) reviveDataDates(raw);
    return raw;
  }
  const key = `${userId}:${stateType}`;
  const raw = memory.get(key) ?? null;
  if (raw) reviveDataDates(raw);
  return raw;
}

export async function setState(
  userId: number,
  stateType: StateType,
  payload: Record<string, unknown>
): Promise<void> {
  const client = getSupabase();
  if (client) {
    await client
      .from("user_form_state")
      .upsert(
        { user_id: userId, state_type: stateType, payload, updated_at: new Date().toISOString() },
        { onConflict: "user_id,state_type" }
      );
    return;
  }
  memory.set(`${userId}:${stateType}`, JSON.parse(JSON.stringify(payload)));
}

export async function deleteState(userId: number, stateType: StateType): Promise<void> {
  const client = getSupabase();
  if (client) {
    await client.from("user_form_state").delete().eq("user_id", userId).eq("state_type", stateType);
    return;
  }
  memory.delete(`${userId}:${stateType}`);
}

