import {
  PrayerFormState,
  PrayerFormStep,
  PrayerFormData,
} from "../types";
import { logInfo, logWarn } from "./logger";
import * as stateStore from "./stateStore";

export async function getPrayerState(userId: number): Promise<PrayerFormState | undefined> {
  const raw = await stateStore.getState(userId, "prayer");
  return raw != null ? (raw as unknown as PrayerFormState) : undefined;
}

export async function setPrayerState(
  userId: number,
  state: PrayerFormState
): Promise<void> {
  await stateStore.setState(userId, "prayer", state as unknown as Record<string, unknown>);
  logInfo("Prayer form state updated", {
    userId,
    step: state.step,
    weekType: state.data.weekType,
  });
}

export async function initPrayerState(
  userId: number,
  chatId: number
): Promise<PrayerFormState> {
  const state: PrayerFormState = {
    userId,
    chatId,
    step: "week",
    data: {},
    waitingForTextInput: false,
  };
  await setPrayerState(userId, state);
  return state;
}

export async function updatePrayerStep(
  userId: number,
  step: PrayerFormStep
): Promise<void> {
  const state = await getPrayerState(userId);
  if (state) {
    state.step = step;
    await setPrayerState(userId, state);
  } else {
    logWarn("Attempted to update step for non-existent prayer state", { userId });
  }
}

export async function updatePrayerData(
  userId: number,
  updates: Partial<PrayerFormData>
): Promise<void> {
  const state = await getPrayerState(userId);
  if (state) {
    state.data = { ...state.data, ...updates };
    await setPrayerState(userId, state);
  } else {
    logWarn("Attempted to update data for non-existent prayer state", { userId });
  }
}

export async function setWaitingForTextInput(
  userId: number,
  waiting: boolean
): Promise<void> {
  const state = await getPrayerState(userId);
  if (state) {
    state.waitingForTextInput = waiting;
    await setPrayerState(userId, state);
  }
}

export async function setMessageId(userId: number, messageId: number): Promise<void> {
  const state = await getPrayerState(userId);
  if (state) {
    state.messageId = messageId;
    await setPrayerState(userId, state);
  }
}

export async function clearPrayerState(userId: number): Promise<void> {
  await stateStore.deleteState(userId, "prayer");
  logInfo("Prayer form state cleared", { userId });
}

export async function hasActivePrayerState(userId: number): Promise<boolean> {
  const raw = await stateStore.getState(userId, "prayer");
  return raw != null;
}
