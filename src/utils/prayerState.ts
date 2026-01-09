import {
  PrayerFormState,
  PrayerFormStep,
  PrayerFormData,
} from "../types";
import { logInfo, logWarn } from "./logger";

// In-memory storage for user states
const userStates = new Map<number, PrayerFormState>();

/**
 * Get state for a user
 */
export const getPrayerState = (userId: number): PrayerFormState | undefined => {
  return userStates.get(userId);
};

/**
 * Set state for a user
 */
export const setPrayerState = (
  userId: number,
  state: PrayerFormState
): void => {
  userStates.set(userId, state);
  logInfo("Prayer form state updated", {
    userId,
    step: state.step,
    weekType: state.data.weekType,
  });
};

/**
 * Initialize new state for a user
 */
export const initPrayerState = (
  userId: number,
  chatId: number
): PrayerFormState => {
  const state: PrayerFormState = {
    userId,
    chatId,
    step: "week",
    data: {},
    waitingForTextInput: false,
  };
  setPrayerState(userId, state);
  return state;
};

/**
 * Update step in user state
 */
export const updatePrayerStep = (
  userId: number,
  step: PrayerFormStep
): void => {
  const state = getPrayerState(userId);
  if (state) {
    state.step = step;
    setPrayerState(userId, state);
  } else {
    logWarn("Attempted to update step for non-existent prayer state", { userId });
  }
};

/**
 * Update data in user state
 */
export const updatePrayerData = (
  userId: number,
  updates: Partial<PrayerFormData>
): void => {
  const state = getPrayerState(userId);
  if (state) {
    state.data = { ...state.data, ...updates };
    setPrayerState(userId, state);
  } else {
    logWarn("Attempted to update data for non-existent prayer state", { userId });
  }
};

/**
 * Set waiting for text input flag
 */
export const setWaitingForTextInput = (
  userId: number,
  waiting: boolean
): void => {
  const state = getPrayerState(userId);
  if (state) {
    state.waitingForTextInput = waiting;
    setPrayerState(userId, state);
  }
};

/**
 * Set message ID for state
 */
export const setMessageId = (userId: number, messageId: number): void => {
  const state = getPrayerState(userId);
  if (state) {
    state.messageId = messageId;
    setPrayerState(userId, state);
  }
};

/**
 * Clear state for a user
 */
export const clearPrayerState = (userId: number): void => {
  const deleted = userStates.delete(userId);
  if (deleted) {
    logInfo("Prayer form state cleared", { userId });
  }
};

/**
 * Check if user has active state
 */
export const hasActivePrayerState = (userId: number): boolean => {
  return userStates.has(userId);
};

