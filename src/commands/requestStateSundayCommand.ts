import { CommandResult } from "../types";
import { sendMessage } from "../services/telegramService";
import { getSundayMeeting } from "../services/calendarService";
import { formatSundayServiceMessage } from "../utils/sundayServiceFormatter";
import { getAppConfig } from "../config/environment";
import { logInfo, logWarn, logError } from "../utils/logger";

/**
 * Execute /request_state_sunday command
 * Gets and sends information about the next Sunday service
 */
export const executeRequestStateSundayCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult> => {
  logInfo("Executing request state sunday command", { userId, chatId });

  try {
    const appConfig = getAppConfig();

    // Check if debug mode is active
    if (appConfig.debug) {
      logInfo("DEBUG mode is active, sending debug message");
      return await sendMessage(
        chatId,
        "DEBUG-режим активен, рассылка не будет отправлена"
      );
    }

    // Get Sunday service information
    const serviceInfo = await getSundayMeeting();

    if (!serviceInfo) {
      logInfo("No Sunday service information found");
      const noDataMessage = formatSundayServiceMessage(null);
      return await sendMessage(chatId, noDataMessage);
    }

    // Format and send the message
    const message = formatSundayServiceMessage(serviceInfo);
    const result = await sendMessage(chatId, message, { parse_mode: "HTML" });

    if (result.success) {
      logInfo("Sunday service information sent successfully", {
        userId,
        chatId,
        serviceDate: serviceInfo.date.toISOString(),
        servicesCount: serviceInfo.services.length,
      });
    } else {
      logWarn("Failed to send Sunday service information", {
        userId,
        chatId,
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    logError("Error in request state sunday command", error);
    return {
      success: false,
      error: "Произошла ошибка при получении информации о воскресном служении",
    };
  }
};

/**
 * Send Sunday service information to a specific user
 * Used for direct messaging to authorized users
 */
export const sendSundayServiceToUser = async (
  userId: number
): Promise<CommandResult> => {
  logInfo("Sending Sunday service to user", { userId });

  try {
    const appConfig = getAppConfig();

    // Check if debug mode is active
    if (appConfig.debug) {
      logInfo("DEBUG mode is active, sending debug message to user");
      return await sendMessage(
        userId,
        "DEBUG-режим активен, рассылка не будет отправлена"
      );
    }

    // Get Sunday service information
    const serviceInfo = await getSundayMeeting();

    if (!serviceInfo) {
      logInfo("No Sunday service information found for user");
      const noDataMessage = formatSundayServiceMessage(null);
      return await sendMessage(userId, noDataMessage);
    }

    // Format and send the message
    const message = formatSundayServiceMessage(serviceInfo);
    const result = await sendMessage(userId, message, { parse_mode: "HTML" });

    if (result.success) {
      logInfo("Sunday service information sent to user successfully", {
        userId,
        serviceDate: serviceInfo.date.toISOString(),
        servicesCount: serviceInfo.services.length,
      });
    } else {
      logWarn("Failed to send Sunday service information to user", {
        userId,
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    logError("Error sending Sunday service to user", error);
    return {
      success: false,
      error: "Произошла ошибка при отправке информации о воскресном служении",
    };
  }
};

/**
 * Send Sunday service information to main group
 * Used for broadcasting to the main church group
 */
export const sendSundayServiceToMainGroup =
  async (): Promise<CommandResult> => {
    logInfo("Sending Sunday service to main group");

    try {
      const appConfig = getAppConfig();

      // Check if debug mode is active
      if (appConfig.debug) {
        logInfo("DEBUG mode is active, not sending to main group");
        return {
          success: true,
          message:
            "DEBUG-режим активен, рассылка в основную группу не будет отправлена",
        };
      }

      // Get Sunday service information
      const serviceInfo = await getSundayMeeting();

      if (!serviceInfo) {
        logInfo("No Sunday service information found for main group");
        return {
          success: true,
          message: "Информация о воскресном служении пока недоступна",
        };
      }

      // Format the message
      const message = formatSundayServiceMessage(serviceInfo);

      // Note: This would need to be implemented with the main group ID
      // For now, we'll just log the message that would be sent
      logInfo("Sunday service message for main group", {
        message: message.substring(0, 200) + "...",
        serviceDate: serviceInfo.date.toISOString(),
        servicesCount: serviceInfo.services.length,
      });

      return {
        success: true,
        message:
          "Информация о воскресном служении подготовлена для отправки в основную группу",
      };
    } catch (error) {
      logError("Error preparing Sunday service for main group", error);
      return {
        success: false,
        error:
          "Произошла ошибка при подготовке информации о воскресном служении для основной группы",
      };
    }
  };
