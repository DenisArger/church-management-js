import { YouTubeBroadcast, YouTubeBroadcastMailing, PostDeletion } from "../types/youtubeBroadcast";
import { logInfo, logError, logWarn } from "../utils/logger";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    try {
      supabase = createClient(url, key);
    } catch {
      supabase = null;
    }
  }
  return supabase;
}

export const scheduleBroadcastMailing = async (
  broadcast: YouTubeBroadcast,
  delayMinutes: number = 5
): Promise<YouTubeBroadcastMailing | null> => {
  const client = getClient();
  if (!client) {
    logWarn("Supabase not configured, cannot schedule broadcast mailing");
    return null;
  }

  const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data, error } = await client
    .from("youtube_broadcast_mailings")
    .insert({
      youtube_id: broadcast.youtubeId,
      title: broadcast.title,
      privacy_status: broadcast.privacyStatus,
      scheduled_start_time: broadcast.scheduledStartTime,
      scheduled_for: scheduledFor,
      sent_at: null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error || !data) {
    logError("Failed to schedule broadcast mailing", error);
    return null;
  }

  logInfo("Broadcast mailing scheduled", {
    mailingId: data.id,
    youtubeId: broadcast.youtubeId,
    scheduledFor,
  });

  return {
    id: data.id,
    youtubeId: data.youtube_id,
    title: data.title,
    privacyStatus: data.privacy_status,
    scheduledStartTime: data.scheduled_start_time,
    scheduledFor: data.scheduled_for,
    sentAt: data.sent_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};

export const getPendingBroadcastMailings = async (): Promise<YouTubeBroadcastMailing[]> => {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from("youtube_broadcast_mailings")
    .select("*")
    .is("sent_at", null)
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true });

  if (error || !data) {
    logError("Failed to fetch pending broadcast mailings", error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    youtubeId: row.youtube_id,
    title: row.title,
    privacyStatus: row.privacy_status,
    scheduledStartTime: row.scheduled_start_time,
    scheduledFor: row.scheduled_for,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const markBroadcastMailingSent = async (mailingId: string): Promise<boolean> => {
  const client = getClient();
  if (!client) return false;

  const { error } = await client
    .from("youtube_broadcast_mailings")
    .update({
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", mailingId);

  if (error) {
    logError("Failed to mark mailing as sent", error);
    return false;
  }
  return true;
};

export const schedulePostDeletion = async (
  chatId: number,
  messageId: number,
  deleteAfterHours: number = 11
): Promise<PostDeletion | null> => {
  const client = getClient();
  if (!client) {
    logWarn("Supabase not configured, cannot schedule post deletion");
    return null;
  }

  const deleteAt = new Date(Date.now() + deleteAfterHours * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data, error } = await client
    .from("telegram_post_deletions")
    .insert({
      chat_id: chatId,
      message_id: messageId,
      delete_at: deleteAt,
      created_at: now,
    })
    .select()
    .single();

  if (error || !data) {
    logError("Failed to schedule post deletion", error);
    return null;
  }

  logInfo("Post deletion scheduled", {
    chatId,
    messageId,
    deleteAt,
  });

  return {
    id: data.id,
    chatId: data.chat_id,
    messageId: data.message_id,
    deleteAt: data.delete_at,
    createdAt: data.created_at,
  };
};

export const getPendingPostDeletions = async (): Promise<PostDeletion[]> => {
  const client = getClient();
  if (!client) return [];

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("telegram_post_deletions")
    .select("*")
    .lte("delete_at", now)
    .order("delete_at", { ascending: true });

  if (error || !data) {
    logError("Failed to fetch pending post deletions", error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    chatId: row.chat_id,
    messageId: row.message_id,
    deleteAt: row.delete_at,
    createdAt: row.created_at,
  }));
};

export const deleteProcessedPostDeletions = async (ids: string[]): Promise<void> => {
  const client = getClient();
  if (!client || ids.length === 0) return;

  const { error } = await client
    .from("telegram_post_deletions")
    .delete()
    .in("id", ids);

  if (error) {
    logError("Failed to delete processed post deletions", error);
  }
};
