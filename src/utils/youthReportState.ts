import {
  YouthReportState,
  YouthReportFormStep,
  YouthReportFormData,
} from "../types";
import { logInfo, logWarn } from "./logger";
import * as stateStore from "./stateStore";

export async function getYouthReportState(userId: number): Promise<YouthReportState | undefined> {
  const raw = await stateStore.getState(userId, "youth_report");
  return raw != null ? (raw as unknown as YouthReportState) : undefined;
}

export async function setYouthReportState(
  userId: number,
  state: YouthReportState
): Promise<void> {
  await stateStore.setState(userId, "youth_report", state as unknown as Record<string, unknown>);
  logInfo("Youth report form state updated", {
    userId,
    step: state.step,
    person: state.data.person,
  });
}

export async function initYouthReportState(
  userId: number,
  chatId: number,
  leader: string
): Promise<YouthReportState> {
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
  await setYouthReportState(userId, state);
  return state;
}

export async function updateYouthReportStep(
  userId: number,
  step: YouthReportFormStep
): Promise<void> {
  const state = await getYouthReportState(userId);
  if (state) {
    state.step = step;
    await setYouthReportState(userId, state);
  } else {
    logWarn("Attempted to update step for non-existent youth report state", { userId });
  }
}

export async function updateYouthReportData(
  userId: number,
  updates: Partial<YouthReportFormData>
): Promise<void> {
  const state = await getYouthReportState(userId);
  if (state) {
    state.data = { ...state.data, ...updates };
    await setYouthReportState(userId, state);
  } else {
    logWarn("Attempted to update data for non-existent youth report state", { userId });
  }
}

export async function setWaitingForTextInput(
  userId: number,
  waiting: boolean
): Promise<void> {
  const state = await getYouthReportState(userId);
  if (state) {
    state.waitingForTextInput = waiting;
    await setYouthReportState(userId, state);
  }
}

export async function setMessageId(userId: number, messageId: number): Promise<void> {
  const state = await getYouthReportState(userId);
  if (state) {
    state.messageId = messageId;
    await setYouthReportState(userId, state);
  }
}

export async function clearYouthReportState(userId: number): Promise<void> {
  await stateStore.deleteState(userId, "youth_report");
  logInfo("Youth report form state cleared", { userId });
}

export async function hasActiveYouthReportState(userId: number): Promise<boolean> {
  const raw = await stateStore.getState(userId, "youth_report");
  return raw != null;
}

