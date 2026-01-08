import {
  SundayServiceState,
  SundayServiceStep,
  SundayServiceFormData,
} from "../types";
import { logInfo, logWarn } from "./logger";

// In-memory storage for user states
const userStates = new Map<number, SundayServiceState>();

/**
 * Get state for a user
 */
export const getUserState = (userId: number): SundayServiceState | undefined => {
  return userStates.get(userId);
};

/**
 * Set state for a user
 */
export const setUserState = (
  userId: number,
  state: SundayServiceState
): void => {
  userStates.set(userId, state);
  logInfo("Sunday service state updated", {
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
): SundayServiceState => {
  const state: SundayServiceState = {
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
  step: SundayServiceStep
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
  updates: Partial<SundayServiceFormData>
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
    logInfo("Sunday service state cleared", { userId });
  }
};

/**
 * Check if user has active state
 */
export const hasActiveState = (userId: number): boolean => {
  return userStates.has(userId);
};

/**
 * Get current stream being filled (for both streams mode)
 */
export const getCurrentStream = (
  state: SundayServiceState
): "1" | "2" | undefined => {
  if (state.data.stream === "both") {
    return state.data.currentStream;
  }
  return state.data.stream as "1" | "2" | undefined;
};

/**
 * Save data for current stream (for both streams mode)
 */
export const saveCurrentStreamData = (userId: number): void => {
  const state = getUserState(userId);
  if (!state || state.data.stream !== "both") {
    return;
  }

  const currentStream = getCurrentStream(state);
  if (!currentStream) {
    return;
  }

  // Save current data to appropriate stream
  const streamData: Partial<SundayServiceFormData> = {
    title: state.data.title,
    preachers: state.data.preachers,
    worshipService: state.data.worshipService,
    songBeforeStart: state.data.songBeforeStart,
    numWorshipSongs: state.data.numWorshipSongs,
    soloSong: state.data.soloSong,
    repentanceSong: state.data.repentanceSong,
    scriptureReading: state.data.scriptureReading,
    scriptureReader: state.data.scriptureReader,
  };

  if (currentStream === "1") {
    state.data.stream1Data = streamData;
  } else {
    state.data.stream2Data = streamData;
  }

  // Clear current data for next stream
  state.data.title = undefined;
  state.data.preachers = undefined;
  state.data.worshipService = undefined;
  state.data.songBeforeStart = undefined;
  state.data.numWorshipSongs = undefined;
  state.data.soloSong = undefined;
  state.data.repentanceSong = undefined;
  state.data.scriptureReading = undefined;
  state.data.scriptureReader = undefined;

  setUserState(userId, state);
};

/**
 * Load data for current stream (for both streams mode)
 */
export const loadCurrentStreamData = (userId: number): void => {
  const state = getUserState(userId);
  if (!state || state.data.stream !== "both") {
    return;
  }

  const currentStream = getCurrentStream(state);
  if (!currentStream) {
    return;
  }

  const streamData =
    currentStream === "1" ? state.data.stream1Data : state.data.stream2Data;

  // Preserve metadata fields
  const metadata = {
    mode: state.data.mode,
    date: state.data.date,
    stream: state.data.stream,
    serviceId: state.data.serviceId,
    currentStream: state.data.currentStream,
    stream1Data: state.data.stream1Data,
    stream2Data: state.data.stream2Data,
    preachersPage: state.data.preachersPage,
    worshipServicesList: state.data.worshipServicesList,
    scriptureReadersList: state.data.scriptureReadersList,
  };

  if (streamData) {
    // Load stream data and preserve metadata
    state.data = { ...metadata, ...streamData };
  } else {
    // If no saved data, clear stream-specific fields but preserve metadata
    state.data = {
      ...metadata,
      title: undefined,
      preachers: undefined,
      worshipService: undefined,
      songBeforeStart: undefined,
      numWorshipSongs: undefined,
      soloSong: undefined,
      repentanceSong: undefined,
      scriptureReading: undefined,
      scriptureReader: undefined,
    };
  }
  
  setUserState(userId, state);
};

