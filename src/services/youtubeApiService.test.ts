import * as youtubeApi from "./youtubeApiService";
import * as youtubeToken from "./youtubeTokenService";
import { fetchUpcomingYouTubeBroadcasts, syncYouTubeBroadcasts } from "./youtubeApiService";
import { resetYouTubeTokenCacheForTests } from "./youtubeTokenService";

jest.mock("./youtubeBroadcastService", () => ({
  scheduleBroadcastMailing: jest.fn(),
  getPendingBroadcastMailings: jest.fn(),
}));

jest.mock("../config/environment", () => ({
  getYouTubeConfig: jest.fn(),
}));

jest.mock("../utils/logger", () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
}));

const { scheduleBroadcastMailing } = jest.requireMock(
  "./youtubeBroadcastService"
) as {
  scheduleBroadcastMailing: jest.Mock;
};

const { getPendingBroadcastMailings } = jest.requireMock(
  "./youtubeBroadcastService"
) as {
  getPendingBroadcastMailings: jest.Mock;
};

const { getYouTubeConfig } = jest.requireMock(
  "../config/environment"
) as {
  getYouTubeConfig: jest.Mock;
};

const createMockFetch = () => jest.fn();

describe("youtubeApiService", () => {
  let mockFetch: ReturnType<typeof createMockFetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = createMockFetch();
    global.fetch = mockFetch;
    resetYouTubeTokenCacheForTests();
    jest.spyOn(youtubeToken, "getYouTubeAccessToken").mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("fetchUpcomingYouTubeBroadcasts", () => {
    it("returns empty array when YouTube API not configured", async () => {
      getYouTubeConfig.mockReturnValue({
        apiKey: "",
        channelId: "",
        clientId: "",
        clientSecret: "",
        refreshToken: "",
      });

      const result = await fetchUpcomingYouTubeBroadcasts();

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("fetches upcoming broadcasts via OAuth", async () => {
      getYouTubeConfig.mockReturnValue({
        apiKey: "",
        channelId: "UC123",
        clientId: "client-id",
        clientSecret: "client-secret",
        refreshToken: "refresh-token",
      });
      (youtubeToken.getYouTubeAccessToken as jest.Mock).mockResolvedValue("access-token-123");

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                id: { kind: "youtube#video", videoId: "abc123" },
                snippet: {
                  title: "Upcoming Stream",
                  description: "Desc",
                  publishedAt: "2026-07-15T10:00:00Z",
                  liveBroadcastContent: "upcoming",
                },
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                id: "abc123",
                liveStreamingDetails: {
                  scheduledStartTime: "2026-07-20T10:00:00Z",
                },
              },
            ],
          }),
        });

      const result = await fetchUpcomingYouTubeBroadcasts();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        youtubeId: "abc123",
        title: "Upcoming Stream",
        privacyStatus: "public",
        scheduledStartTime: "2026-07-20T10:00:00Z",
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(youtubeToken.getYouTubeAccessToken).toHaveBeenCalledTimes(2);
    });

    it("fetches upcoming broadcasts via API key fallback", async () => {
      getYouTubeConfig.mockReturnValue({
        apiKey: "api-key",
        channelId: "UC123",
        clientId: "",
        clientSecret: "",
        refreshToken: "",
      });
      (youtubeToken.getYouTubeAccessToken as jest.Mock).mockResolvedValue(null);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                id: { kind: "youtube#video", videoId: "abc123" },
                snippet: {
                  title: "Upcoming Stream",
                  description: "Desc",
                  publishedAt: "2026-07-15T10:00:00Z",
                  liveBroadcastContent: "upcoming",
                },
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                id: "abc123",
                liveStreamingDetails: {
                  scheduledStartTime: "2026-07-20T10:00:00Z",
                },
              },
            ],
          }),
        });

      const result = await fetchUpcomingYouTubeBroadcasts();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        youtubeId: "abc123",
        title: "Upcoming Stream",
        privacyStatus: "public",
        scheduledStartTime: "2026-07-20T10:00:00Z",
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(youtubeToken.getYouTubeAccessToken).toHaveBeenCalledTimes(2);
    });

    it("skips videos without scheduledStartTime", async () => {
      getYouTubeConfig.mockReturnValue({
        apiKey: "api-key",
        channelId: "UC123",
        clientId: "",
        clientSecret: "",
        refreshToken: "",
      });
      (youtubeToken.getYouTubeAccessToken as jest.Mock).mockResolvedValue(null);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                id: { kind: "youtube#video", videoId: "abc123" },
                snippet: {
                  title: "Stream without time",
                  publishedAt: "2026-07-15T10:00:00Z",
                  liveBroadcastContent: "upcoming",
                },
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                id: "abc123",
                liveStreamingDetails: {},
              },
            ],
          }),
        });

      const result = await fetchUpcomingYouTubeBroadcasts();

      expect(result).toEqual([]);
    });

    it("returns empty array on API error", async () => {
      getYouTubeConfig.mockReturnValue({
        apiKey: "api-key",
        channelId: "UC123",
        clientId: "",
        clientSecret: "",
        refreshToken: "",
      });
      (youtubeToken.getYouTubeAccessToken as jest.Mock).mockResolvedValue(null);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: async () => "Access denied",
      });

      const result = await fetchUpcomingYouTubeBroadcasts();

      expect(result).toEqual([]);
    });
  });

  describe("syncYouTubeBroadcasts", () => {
    it("creates mailings for new broadcasts", async () => {
      getYouTubeConfig.mockReturnValue({
        apiKey: "",
        channelId: "UC123",
        clientId: "client-id",
        clientSecret: "client-secret",
        refreshToken: "refresh-token",
      });
      (youtubeToken.getYouTubeAccessToken as jest.Mock).mockResolvedValue("access-token-123");
      getPendingBroadcastMailings.mockResolvedValue([]);
      scheduleBroadcastMailing.mockResolvedValue({
        id: "mailing-1",
        youtubeId: "abc123",
        title: "Stream",
        privacyStatus: "public",
        scheduledStartTime: "2026-07-20T10:00:00Z",
        scheduledFor: "2026-07-20T09:55:00Z",
        sentAt: null,
        createdAt: "2026-07-20T09:50:00Z",
        updatedAt: "2026-07-20T09:50:00Z",
      });

      jest.spyOn(youtubeApi, "fetchUpcomingYouTubeBroadcasts").mockResolvedValue([
        {
          youtubeId: "abc123",
          title: "Stream",
          privacyStatus: "public",
          scheduledStartTime: "2026-07-20T10:00:00Z",
        },
      ]);

      const result = await syncYouTubeBroadcasts();

      expect(result).toEqual({ created: 1, skipped: 0, failed: 0 });
      expect(scheduleBroadcastMailing).toHaveBeenCalledWith({
        youtubeId: "abc123",
        title: "Stream",
        privacyStatus: "public",
        scheduledStartTime: "2026-07-20T10:00:00Z",
      }, 5);
    });

    it("skips already scheduled broadcasts", async () => {
      getYouTubeConfig.mockReturnValue({
        apiKey: "",
        channelId: "UC123",
        clientId: "client-id",
        clientSecret: "client-secret",
        refreshToken: "refresh-token",
      });
      (youtubeToken.getYouTubeAccessToken as jest.Mock).mockResolvedValue("access-token-123");
      getPendingBroadcastMailings.mockResolvedValue([
        {
          id: "mailing-1",
          youtubeId: "abc123",
          title: "Stream",
          privacyStatus: "public",
          scheduledStartTime: "2026-07-20T10:00:00Z",
          scheduledFor: "2026-07-20T09:55:00Z",
          sentAt: null,
          createdAt: "2026-07-20T09:50:00Z",
          updatedAt: "2026-07-20T09:50:00Z",
        },
      ]);

      jest.spyOn(youtubeApi, "fetchUpcomingYouTubeBroadcasts").mockResolvedValue([
        {
          youtubeId: "abc123",
          title: "Stream",
          privacyStatus: "public",
          scheduledStartTime: "2026-07-20T10:00:00Z",
        },
      ]);

      const result = await syncYouTubeBroadcasts();

      expect(result).toEqual({ created: 0, skipped: 1, failed: 0 });
      expect(scheduleBroadcastMailing).not.toHaveBeenCalled();
    });

    it("handles multiple broadcasts", async () => {
      getYouTubeConfig.mockReturnValue({
        apiKey: "",
        channelId: "UC123",
        clientId: "client-id",
        clientSecret: "client-secret",
        refreshToken: "refresh-token",
      });
      (youtubeToken.getYouTubeAccessToken as jest.Mock).mockResolvedValue("access-token-123");
      getPendingBroadcastMailings.mockResolvedValue([]);
      scheduleBroadcastMailing
        .mockResolvedValueOnce({
          id: "mailing-1",
          youtubeId: "abc123",
          title: "Stream 1",
          privacyStatus: "public",
          scheduledStartTime: "2026-07-20T10:00:00Z",
          scheduledFor: "2026-07-20T09:55:00Z",
          sentAt: null,
          createdAt: "2026-07-20T09:50:00Z",
          updatedAt: "2026-07-20T09:50:00Z",
        })
        .mockResolvedValueOnce({
          id: "mailing-2",
          youtubeId: "def456",
          title: "Stream 2",
          privacyStatus: "public",
          scheduledStartTime: "2026-07-27T10:00:00Z",
          scheduledFor: "2026-07-27T09:55:00Z",
          sentAt: null,
          createdAt: "2026-07-27T09:50:00Z",
          updatedAt: "2026-07-27T09:50:00Z",
        });

      jest.spyOn(youtubeApi, "fetchUpcomingYouTubeBroadcasts").mockResolvedValue([
        {
          youtubeId: "abc123",
          title: "Stream 1",
          privacyStatus: "public",
          scheduledStartTime: "2026-07-20T10:00:00Z",
        },
        {
          youtubeId: "def456",
          title: "Stream 2",
          privacyStatus: "public",
          scheduledStartTime: "2026-07-27T10:00:00Z",
        },
      ]);

      const result = await syncYouTubeBroadcasts();

      expect(result).toEqual({ created: 2, skipped: 0, failed: 0 });
      expect(scheduleBroadcastMailing).toHaveBeenCalledTimes(2);
    });
  });
});
