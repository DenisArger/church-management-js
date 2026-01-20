import {
  SundayServiceState,
  SundayServiceStep,
  SundayServiceFormData,
} from "../types";
import { logInfo, logWarn } from "./logger";
import * as stateStore from "./stateStore";

export async function getUserState(userId: number): Promise<SundayServiceState | undefined> {
  const raw = await stateStore.getState(userId, "sunday_service");
  return raw != null ? (raw as unknown as SundayServiceState) : undefined;
}

export async function setUserState(
  userId: number,
  state: SundayServiceState
): Promise<void> {
  await stateStore.setState(userId, "sunday_service", state as unknown as Record<string, unknown>);
  logInfo("Sunday service state updated", {
    userId,
    step: state.step,
    mode: state.data.mode,
  });
}

export async function initUserState(
  userId: number,
  chatId: number
): Promise<SundayServiceState> {
  const state: SundayServiceState = {
    userId,
    chatId,
    step: "mode",
    data: {},
    waitingForTextInput: false,
  };
  await setUserState(userId, state);
  return state;
}

export async function updateStep(
  userId: number,
  step: SundayServiceStep
): Promise<void> {
  const state = await getUserState(userId);
  if (state) {
    state.step = step;
    await setUserState(userId, state);
  } else {
    logWarn("Attempted to update step for non-existent state", { userId });
  }
}

export async function updateStateData(
  userId: number,
  updates: Partial<SundayServiceFormData>
): Promise<void> {
  const state = await getUserState(userId);
  if (state) {
    state.data = { ...state.data, ...updates };
    await setUserState(userId, state);
  } else {
    logWarn("Attempted to update data for non-existent state", { userId });
  }
}

export async function setWaitingForTextInput(
  userId: number,
  waiting: boolean
): Promise<void> {
  const state = await getUserState(userId);
  if (state) {
    state.waitingForTextInput = waiting;
    await setUserState(userId, state);
  }
}

export async function setMessageId(userId: number, messageId: number): Promise<void> {
  const state = await getUserState(userId);
  if (state) {
    state.messageId = messageId;
    await setUserState(userId, state);
  }
}

export async function clearUserState(userId: number): Promise<void> {
  await stateStore.deleteState(userId, "sunday_service");
  logInfo("Sunday service state cleared", { userId });
}

export async function hasActiveState(userId: number): Promise<boolean> {
  const raw = await stateStore.getState(userId, "sunday_service");
  return raw != null;
}

export function getCurrentStream(
  state: SundayServiceState
): "1" | "2" | undefined {
  if (state.data.stream === "both") {
    return state.data.currentStream;
  }
  return state.data.stream as "1" | "2" | undefined;
}

export async function saveCurrentStreamData(userId: number): Promise<void> {
  const state = await getUserState(userId);
  if (!state || state.data.stream !== "both") {
    return;
  }

  const currentStream = getCurrentStream(state);
  if (!currentStream) {
    return;
  }

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

  state.data.title = undefined;
  state.data.preachers = undefined;
  state.data.worshipService = undefined;
  state.data.songBeforeStart = undefined;
  state.data.numWorshipSongs = undefined;
  state.data.soloSong = undefined;
  state.data.repentanceSong = undefined;
  state.data.scriptureReading = undefined;
  state.data.scriptureReader = undefined;

  await setUserState(userId, state);
}

export async function loadCurrentStreamData(userId: number): Promise<void> {
  const state = await getUserState(userId);
  if (!state || state.data.stream !== "both") {
    return;
  }

  const currentStream = getCurrentStream(state);
  if (!currentStream) {
    return;
  }

  const streamData =
    currentStream === "1" ? state.data.stream1Data : state.data.stream2Data;

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
    state.data = { ...metadata, ...streamData };
  } else {
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

  await setUserState(userId, state);
}