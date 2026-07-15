import { getYouTubeConfig } from "../config/environment";
import { logInfo, logError, logWarn } from "../utils/logger";

const YOUTUBE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

interface YouTubeOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export const getYouTubeAccessToken = async (): Promise<string | null> => {
  const config = getYouTubeConfig();
  const clientId = config.clientId?.trim();
  const clientSecret = config.clientSecret?.trim();
  const refreshToken = config.refreshToken?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt) {
    return cachedAccessToken.token;
  }

  try {
    const params = new URLSearchParams();
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);
    params.set("refresh_token", refreshToken);
    params.set("grant_type", "refresh_token");

    const response = await fetch(YOUTUBE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError("YouTube OAuth token refresh failed", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      return null;
    }

    const data = (await response.json()) as YouTubeOAuthTokenResponse;
    const expiresIn = data.expires_in || 3600;

    cachedAccessToken = {
      token: data.access_token,
      expiresAt: Date.now() + (expiresIn - 60) * 1000,
    };

    logInfo("YouTube OAuth access token refreshed", {
      expiresIn,
      expiresAt: new Date(cachedAccessToken.expiresAt).toISOString(),
    });

    return cachedAccessToken.token;
  } catch (error) {
    logError("Failed to refresh YouTube OAuth token", error);
    cachedAccessToken = null;
    return null;
  }
};

export const resetYouTubeTokenCacheForTests = (): void => {
  cachedAccessToken = null;
};
