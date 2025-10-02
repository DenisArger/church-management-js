import { getTelegramConfig } from "../config/environment";
import { logInfo, logWarn } from "./logger";

/**
 * Check if user is authorized to use bot commands
 * @param userId - Telegram user ID
 * @returns true if user is authorized, false otherwise
 */
export const isUserAuthorized = (userId: number): boolean => {
  const { allowedUsers } = getTelegramConfig();

  if (allowedUsers.length === 0) {
    logWarn("No allowed users configured, denying access", { userId });
    return false;
  }

  const isAuthorized = allowedUsers.includes(userId);

  if (isAuthorized) {
    logInfo("User authorized", { userId });
  } else {
    logWarn("User not authorized", { userId, allowedUsers });
  }

  return isAuthorized;
};

/**
 * Get unauthorized access message
 * @returns Message to send to unauthorized users
 */
export const getUnauthorizedMessage = (): string => {
  return `🔒 <b>Доступ ограничен</b>

Эта команда доступна только авторизованным пользователям.

Если вы считаете, что должны иметь доступ к этой команде, обратитесь к администратору.`;
};
