import {
  YouthReportState,
  YouthReportFormStep,
  YouthReportFormData,
} from "../types";
import { logInfo, logWarn } from "./logger";

// In-memory storage for user states
const userStates = new Map<number, YouthReportState>();

/**
 * Get state for a user
 */
export const getYouthReportState = (userId: number): YouthReportState | undefined => {
  return userStates.get(userId);
};

/**
 * Set state for a user
 */
export const setYouthReportState = (
  userId: number,
  state: YouthReportState
): void => {
  userStates.set(userId, state);
  logInfo("Youth report form state updated", {
    userId,
    step: state.step,
    person: state.data.person,
  });
};

/**
 * Initialize new state for a user
 */
export const initYouthReportState = (
  userId: number,
  chatId: number,
  leader: string
): YouthReportState => {
  const state: YouthReportState = {
    userId,
    chatId,
    step: "person",
    data: {
      leader,
      date: new Date(),
    },
    waitingForTextInput: false,
  };
  setYouthReportState(userId, state);
  return state;
};

/**
 * Update step in user state
 */
export const updateYouthReportStep = (
  userId: number,
  step: YouthReportFormStep
): void => {
  const state = getYouthReportState(userId);
  if (state) {
    state.step = step;
    setYouthReportState(userId, state);
  } else {
    logWarn("Attempted to update step for non-existent youth report state", { userId });
  }
};

/**
 * Update data in user state
 */
export const updateYouthReportData = (
  userId: number,
  updates: Partial<YouthReportFormData>
): void => {
  const state = getYouthReportState(userId);
  if (state) {
    state.data = { ...state.data, ...updates };
    setYouthReportState(userId, state);
  } else {
    logWarn("Attempted to update data for non-existent youth report state", { userId });
  }
};

/**
 * Set waiting for text input flag
 */
export const setWaitingForTextInput = (
  userId: number,
  waiting: boolean
): void => {
  const state = getYouthReportState(userId);
  if (state) {
    state.waitingForTextInput = waiting;
    setYouthReportState(userId, state);
  }
};

/**
 * Set message ID for state
 */
export const setMessageId = (userId: number, messageId: number): void => {
  const state = getYouthReportState(userId);
  if (state) {
    state.messageId = messageId;
    setYouthReportState(userId, state);
  }
};

/**
 * Clear state for a user
 */
export const clearYouthReportState = (userId: number): void => {
  const deleted = userStates.delete(userId);
  if (deleted) {
    logInfo("Youth report form state cleared", { userId });
  }
};

/**
 * Check if user has active state
 */
export const hasActiveYouthReportState = (userId: number): boolean => {
  return userStates.has(userId);
};



