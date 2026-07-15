import { YouTubeBroadcast } from "../types/youtubeBroadcast";
import { getYouTubeConfig } from "../config/environment";
import { scheduleBroadcastMailing, getPendingBroadcastMailings } from "./youtubeBroadcastService";
import { getYouTubeAccessToken } from "./youtubeTokenService";
import { logInfo, logError, logWarn } from "../utils/logger";

const YOUTUBE_DATA_API_BASE = "https://www.googleapis.com/youtube/v3";

interface YouTubeSearchItem {
  id: {
    kind: string;
    videoId: string;
  };
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    liveBroadcastContent: "none" | "live" | "upcoming";
  };
}

interface YouTubeVideoDetails {
  id: string;
  liveStreamingDetails?: {
    scheduledStartTime?: string;
    actualStartTime?: string;
    activeLiveChatId?: string;
  };
}

interface YouTubeSearchResponse {
  items: YouTubeSearchItem[];
  nextPageToken?: string;
}

interface YouTubeVideosResponse {
  items: YouTubeVideoDetails[];
}

async function youtubeGet<T>(
  path: string,
  params: Record<string, string>
): Promise<T | null> {
  const accessToken = await getYouTubeAccessToken();
  const config = getYouTubeConfig();

  if (accessToken) {
    const url = new URL(`${YOUTUBE_DATA_API_BASE}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError("YouTube OAuth API error", {
        path,
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      return null;
    }

    return (await response.json()) as T;
  }

  const apiKey = config.apiKey?.trim();
  const channelId = config.channelId?.trim();

  if (!apiKey || !channelId) {
    logWarn("YouTube API not configured, skipping broadcast polling", {
      hasAccessToken: Boolean(accessToken),
      hasApiKey: Boolean(apiKey),
      hasChannelId: Boolean(channelId),
    });
    return null;
  }

  const url = new URL(`${YOUTUBE_DATA_API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logError("YouTube API key API error", {
      path,
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    return null;
  }

  return (await response.json()) as T;
}

export const fetchUpcomingYouTubeBroadcasts = async (): Promise<YouTubeBroadcast[]> => {
  const config = getYouTubeConfig();
  const channelId = config.channelId?.trim();

  if (!channelId) {
    logWarn("YouTube channel ID not configured, skipping broadcast polling");
    return [];
  }

  try {
    const searchData = await youtubeGet<YouTubeSearchResponse>("/search", {
      part: "snippet",
      channelId,
      eventType: "upcoming",
      type: "video",
      order: "date",
      maxResults: "10",
    });

    if (!searchData || !searchData.items || searchData.items.length === 0) {
      logInfo("No upcoming YouTube broadcasts found");
      return [];
    }

    const upcomingItems = searchData.items.filter(
      (item) => item.snippet.liveBroadcastContent === "upcoming"
    );

    if (upcomingItems.length === 0) {
      logInfo("No upcoming YouTube broadcasts found after filtering");
      return [];
    }

    const videoIds = upcomingItems.map((item) => item.id.videoId).join(",");
    const videosData = await youtubeGet<YouTubeVideosResponse>("/videos", {
      part: "liveStreamingDetails",
      id: videoIds,
    });

    if (!videosData || !videosData.items || videosData.items.length === 0) {
      logWarn("YouTube videos API returned no details for upcoming broadcasts", {
        videoIds,
      });
      return [];
    }

    const broadcasts: YouTubeBroadcast[] = [];
    for (const item of upcomingItems) {
      const videoDetails = videosData.items.find((v) => v.id === item.id.videoId);
      const scheduledStartTime = videoDetails?.liveStreamingDetails?.scheduledStartTime;

      if (!scheduledStartTime) {
        logWarn("YouTube upcoming broadcast has no scheduled start time", {
          videoId: item.id.videoId,
          title: item.snippet.title,
        });
        continue;
      }

      broadcasts.push({
        youtubeId: item.id.videoId,
        title: item.snippet.title,
        privacyStatus: "public",
        scheduledStartTime,
      });
    }

    logInfo("Fetched upcoming YouTube broadcasts", { count: broadcasts.length });
    return broadcasts;
  } catch (error) {
    logError("Failed to fetch upcoming YouTube broadcasts", error);
    return [];
  }
};

export const syncYouTubeBroadcasts = async (): Promise<{
  created: number;
  skipped: number;
  failed: number;
}> => {
  const broadcasts = await fetchUpcomingYouTubeBroadcasts();
  const pendingMailings = await getPendingBroadcastMailings();

  const scheduledYouTubeIds = new Set(
    pendingMailings.map((mailing) => mailing.youtubeId)
  );

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const broadcast of broadcasts) {
    if (scheduledYouTubeIds.has(broadcast.youtubeId)) {
      skipped++;
      logInfo("YouTube broadcast already scheduled, skipping", {
        youtubeId: broadcast.youtubeId,
      });
      continue;
    }

    const mailing = await scheduleBroadcastMailing(broadcast, 5);
    if (mailing) {
      created++;
      logInfo("Scheduled broadcast mailing from YouTube", {
        youtubeId: broadcast.youtubeId,
        mailingId: mailing.id,
      });
    } else {
      failed++;
      logError("Failed to schedule broadcast mailing from YouTube", {
        youtubeId: broadcast.youtubeId,
      });
    }
  }

  logInfo("YouTube broadcast sync completed", { created, skipped, failed });
  return { created, skipped, failed };
};
