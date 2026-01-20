import {
  ScheduleState,
  ScheduleFormStep,
  ScheduleFormData,
} from "../types";
import { logInfo, logWarn } from "./logger";
import * as stateStore from "./stateStore";

export async function getUserState(userId: number): Promise<ScheduleState | undefined> {
  const raw = await stateStore.getState(userId, "schedule");
  return raw != null ? (raw as unknown as ScheduleState) : undefined;
}

export async function setUserState(
  userId: number,
  state: ScheduleState
): Promise<void> {
  await stateStore.setState(userId, "schedule", state as unknown as Record<string, unknown>);
  logInfo("Schedule state updated", {
    userId,
    step: state.step,
    mode: state.data.mode,
  });
}

export async function initUserState(
  userId: number,
  chatId: number
): Promise<ScheduleState> {
  const state: ScheduleState = {
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
  step: ScheduleFormStep
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
  updates: Partial<ScheduleFormData>
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
  await stateStore.deleteState(userId, "schedule");
  logInfo("Schedule state cleared", { userId });
}

export async function hasActiveState(userId: number): Promise<boolean> {
  const raw = await stateStore.getState(userId, "schedule");
  return raw != null;
}

