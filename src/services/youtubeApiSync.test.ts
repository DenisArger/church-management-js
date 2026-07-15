import * as youtubeToken from "./youtubeTokenService";
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

jest.mock("./youtubeApiService", () => ({
  getYouTubeAccessToken: jest.fn(),
  computeMailScheduledFor: jest.fn(),
  fetchUpcomingYouTubeBroadcasts: jest.fn(),
  syncYouTubeBroadcasts: jest.fn(),
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

const { computeMailScheduledFor } = jest.requireMock(
  "./youtubeApiService"
) as {
  computeMailScheduledFor: jest.Mock;
};

const { fetchUpcomingYouTubeBroadcasts } = jest.requireMock(
  "./youtubeApiService"
) as {
  fetchUpcomingYouTubeBroadcasts: jest.Mock;
};

const { syncYouTubeBroadcasts } = jest.requireMock(
  "./youtubeApiService"
) as {
  syncYouTubeBroadcasts: jest.Mock;
};

describe("youtubeApiService sync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetYouTubeTokenCacheForTests();
    jest.spyOn(youtubeToken, "getYouTubeAccessToken").mockResolvedValue(null);
    computeMailScheduledFor.mockReturnValue("2026-07-20T06:00:00.000Z");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates mailings for new broadcasts", async () => {
    getYouTubeConfig.mockReturnValue({
      apiKey: "",
      channelId: "UC123",
      clientId: "client-id",
      clientSecret: "client-secret",
      refreshToken: "refresh-token",
    });
    getPendingBroadcastMailings.mockResolvedValue([]);
    scheduleBroadcastMailing.mockResolvedValue({
      id: "mailing-1",
      youtubeId: "abc123",
      title: "Stream",
      privacyStatus: "public",
      scheduledStartTime: "2026-07-20T10:00:00Z",
      scheduledFor: "2026-07-20T06:00:00.000Z",
      sentAt: null,
      createdAt: "2026-07-20T09:50:00.000Z",
      updatedAt: "2026-07-20T09:50:00.000Z",
    });

    syncYouTubeBroadcasts.mockImplementation(async () => {
      const broadcasts = await fetchUpcomingYouTubeBroadcasts();
      const pending = await getPendingBroadcastMailings();
      const scheduledIds = new Set(
        pending.map((m: { youtubeId: string }) => m.youtubeId)
      );

      let created = 0;
      let skipped = 0;
      let failed = 0;

      for (const broadcast of broadcasts) {
        if (scheduledIds.has(broadcast.youtubeId)) {
          skipped++;
          continue;
        }

        const mailing = await scheduleBroadcastMailing(
          broadcast,
          5,
          computeMailScheduledFor(broadcast.scheduledStartTime)
        );
        if (mailing) {
          created++;
        } else {
          failed++;
        }
      }

      return { created, skipped, failed };
    });

    fetchUpcomingYouTubeBroadcasts.mockResolvedValue([
      {
        youtubeId: "abc123",
        title: "Stream",
        privacyStatus: "public",
        scheduledStartTime: "2026-07-20T10:00:00Z",
      },
    ]);

    const result = await syncYouTubeBroadcasts();

    expect(result).toEqual({ created: 1, skipped: 0, failed: 0 });
    expect(computeMailScheduledFor).toHaveBeenCalledWith(
      "2026-07-20T10:00:00Z"
    );
    expect(scheduleBroadcastMailing).toHaveBeenCalledWith(
      {
        youtubeId: "abc123",
        title: "Stream",
        privacyStatus: "public",
        scheduledStartTime: "2026-07-20T10:00:00Z",
      },
      5,
      "2026-07-20T06:00:00.000Z"
    );
  });

  it("skips already scheduled broadcasts", async () => {
    getYouTubeConfig.mockReturnValue({
      apiKey: "",
      channelId: "UC123",
      clientId: "client-id",
      clientSecret: "client-secret",
      refreshToken: "refresh-token",
    });
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

    syncYouTubeBroadcasts.mockImplementation(async () => {
      const broadcasts = await fetchUpcomingYouTubeBroadcasts();
      const pending = await getPendingBroadcastMailings();
      const scheduledIds = new Set(
        pending.map((m: { youtubeId: string }) => m.youtubeId)
      );

      let created = 0;
      let skipped = 0;
      let failed = 0;

      for (const broadcast of broadcasts) {
        if (scheduledIds.has(broadcast.youtubeId)) {
          skipped++;
          continue;
        }

        const mailing = await scheduleBroadcastMailing(
          broadcast,
          5,
          computeMailScheduledFor(broadcast.scheduledStartTime)
        );
        if (mailing) {
          created++;
        } else {
          failed++;
        }
      }

      return { created, skipped, failed };
    });

    fetchUpcomingYouTubeBroadcasts.mockResolvedValue([
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
    getPendingBroadcastMailings.mockResolvedValue([]);
    scheduleBroadcastMailing
      .mockResolvedValueOnce({
        id: "mailing-1",
        youtubeId: "abc123",
        title: "Stream 1",
        privacyStatus: "public",
        scheduledStartTime: "2026-07-20T10:00:00Z",
        scheduledFor: "2026-07-20T06:00:00.000Z",
        sentAt: null,
        createdAt: "2026-07-20T09:50:00.000Z",
        updatedAt: "2026-07-20T09:50:00.000Z",
      })
      .mockResolvedValueOnce({
        id: "mailing-2",
        youtubeId: "def456",
        title: "Stream 2",
        privacyStatus: "public",
        scheduledStartTime: "2026-07-27T10:00:00Z",
        scheduledFor: "2026-07-27T06:00:00.000Z",
        sentAt: null,
        createdAt: "2026-07-27T09:50:00.000Z",
        updatedAt: "2026-07-27T09:50:00.000Z",
      });

    syncYouTubeBroadcasts.mockImplementation(async () => {
      const broadcasts = await fetchUpcomingYouTubeBroadcasts();
      const pending = await getPendingBroadcastMailings();
      const scheduledIds = new Set(
        pending.map((m: { youtubeId: string }) => m.youtubeId)
      );

      let created = 0;
      let skipped = 0;
      let failed = 0;

      for (const broadcast of broadcasts) {
        if (scheduledIds.has(broadcast.youtubeId)) {
          skipped++;
          continue;
        }

        const mailing = await scheduleBroadcastMailing(
          broadcast,
          5,
          computeMailScheduledFor(broadcast.scheduledStartTime)
        );
        if (mailing) {
          created++;
        } else {
          failed++;
        }
      }

      return { created, skipped, failed };
    });

    fetchUpcomingYouTubeBroadcasts.mockResolvedValue([
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
