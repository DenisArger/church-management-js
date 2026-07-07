import { CommandResult } from "../types";
import {
  sendMessage,
  sendPhotoWithOptions,
} from "../services/telegramService";
import { getTelegramConfig } from "../config/environment";
import {
  composeYouTubeBroadcastCaption,
  getBroadcastPhotoId,
  buildWatchButton,
} from "../utils/youtubeBroadcastWording";
import { schedulePostDeletion } from "../services/youtubeBroadcastService";
import { logInfo, logError, logWarn } from "../utils/logger";

const parseId = (raw: string | undefined): number => {
  if (!raw || raw.trim().length === 0) return NaN;
  return parseInt(raw.trim(), 10);
};

export const runBroadcastMailing = async (
  youtubeId: string,
  title: string,
  privacyStatus: string,
  scheduledStartTime: string
): Promise<CommandResult> => {
  try {
    const telegramConfig = getTelegramConfig();
    const isPublic = privacyStatus === "public";

    const caption = composeYouTubeBroadcastCaption(youtubeId, title, scheduledStartTime);
    const photoId = getBroadcastPhotoId();
    const replyMarkup = buildWatchButton(youtubeId);

    const technoGroupId = parseId(telegramConfig.technoGroupId);
    const technoTopicId = parseId(telegramConfig.technoGroupBroadcastTopicId);

    if (isNaN(technoGroupId)) {
      logWarn("Techno group ID not configured, skipping techno group mailing");
      return {
        success: false,
        error: "Techno group ID not configured",
      };
    }

    const messageOptions: Record<string, unknown> = {
      parse_mode: "MarkdownV2",
      reply_markup: replyMarkup,
    };
    if (!isNaN(technoTopicId)) {
      messageOptions.message_thread_id = technoTopicId;
    }

    const messageResult = await sendMessage(technoGroupId, caption, messageOptions);
    if (!messageResult.success) {
      logError("Failed to send techno group message", { error: messageResult.error });
      return {
        success: false,
        error: `Failed to send techno group message: ${messageResult.error}`,
      };
    }

    logInfo("Techno group message sent", {
      chatId: technoGroupId,
      topicId: !isNaN(technoTopicId) ? technoTopicId : undefined,
      messageId: messageResult.data?.messageId,
    });

    const mainGroupId = parseId(telegramConfig.mainGroupId);
    const mainTopicId = parseId(telegramConfig.mainGroupBroadcastTopicId);

    if (isPublic && !isNaN(mainGroupId)) {
      const photoOptions: Record<string, unknown> = {
        caption,
        parse_mode: "MarkdownV2",
        reply_markup: replyMarkup,
      };
      if (!isNaN(mainTopicId)) {
        photoOptions.message_thread_id = mainTopicId;
      }

      const photoResult = await sendPhotoWithOptions(mainGroupId, photoId, photoOptions);
      if (!photoResult.success) {
        logError("Failed to send main group photo", { error: photoResult.error });
        return {
          success: false,
          error: `Failed to send main group photo: ${photoResult.error}`,
        };
      }

      logInfo("Main group photo sent", {
        chatId: mainGroupId,
        topicId: !isNaN(mainTopicId) ? mainTopicId : undefined,
        messageId: photoResult.data?.messageId,
      });
    } else if (isPublic && isNaN(mainGroupId)) {
      logWarn("Main group ID not configured, skipping main group photo");
    }

    const mainChannelId = parseId(telegramConfig.mainChannelId);

    if (isPublic && !isNaN(mainChannelId)) {
      const channelOptions: Record<string, unknown> = {
        caption,
        parse_mode: "MarkdownV2",
        reply_markup: replyMarkup,
      };

      const photoResult = await sendPhotoWithOptions(mainChannelId, photoId, channelOptions);
      if (!photoResult.success) {
        logError("Failed to send main channel photo", { error: photoResult.error });
        return {
          success: false,
          error: `Failed to send main channel photo: ${photoResult.error}`,
        };
      }

      const channelMessageId = Number(photoResult.data?.messageId);
      if (!isNaN(channelMessageId)) {
        await schedulePostDeletion(mainChannelId, channelMessageId, 11);
      }

      logInfo("Main channel photo sent", {
        chatId: mainChannelId,
        messageId: channelMessageId,
      });
    } else if (isPublic && isNaN(mainChannelId)) {
      logWarn("Main channel ID not configured, skipping main channel photo");
    }

    return {
      success: true,
      message: "Broadcast mailing sent successfully",
    };
  } catch (error) {
    logError("Error in broadcast mailing command", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
