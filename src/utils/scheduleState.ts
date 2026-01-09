import {
  ScheduleState,
  ScheduleFormStep,
  ScheduleFormData,
} from "../types";
import { logInfo, logWarn } from "./logger";

// In-memory storage for user states
const userStates = new Map<number, ScheduleState>();

/**
 * Get state for a user
 */
export const getUserState = (userId: number): ScheduleState | undefined => {
  return userStates.get(userId);
};

/**
 * Set state for a user
 */
export const setUserState = (
  userId: number,
  state: ScheduleState
): void => {
  userStates.set(userId, state);
  logInfo("Schedule state updated", {
    userId,
    step: state.step,
    mode: state.data.mode,
  });
};

/**
 * Initialize new state for a user
 */
export const initUserState = (
  userId: number,
  chatId: number
): ScheduleState => {
  const state: ScheduleState = {
    userId,
    chatId,
    step: "mode",
    data: {},
    waitingForTextInput: false,
  };
  setUserState(userId, state);
  return state;
};

/**
 * Update step in user state
 */
export const updateStep = (
  userId: number,
  step: ScheduleFormStep
): void => {
  const state = getUserState(userId);
  if (state) {
    state.step = step;
    setUserState(userId, state);
  } else {
    logWarn("Attempted to update step for non-existent state", { userId });
  }
};

/**
 * Update data in user state
 */
export const updateStateData = (
  userId: number,
  updates: Partial<ScheduleFormData>
): void => {
  const state = getUserState(userId);
  if (state) {
    state.data = { ...state.data, ...updates };
    setUserState(userId, state);
  } else {
    logWarn("Attempted to update data for non-existent state", { userId });
  }
};

/**
 * Set waiting for text input flag
 */
export const setWaitingForTextInput = (
  userId: number,
  waiting: boolean
): void => {
  const state = getUserState(userId);
  if (state) {
    state.waitingForTextInput = waiting;
    setUserState(userId, state);
  }
};

/**
 * Set message ID for state
 */
export const setMessageId = (userId: number, messageId: number): void => {
  const state = getUserState(userId);
  if (state) {
    state.messageId = messageId;
    setUserState(userId, state);
  }
};

/**
 * Clear state for a user
 */
export const clearUserState = (userId: number): void => {
  const deleted = userStates.delete(userId);
  if (deleted) {
    logInfo("Schedule state cleared", { userId });
  }
};

/**
 * Check if user has active state
 */
export const hasActiveState = (userId: number): boolean => {
  return userStates.has(userId);
};


