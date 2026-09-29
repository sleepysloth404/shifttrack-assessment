import * as SecureStore from "expo-secure-store";
import { Session } from "../api/mockApi";

const KEY = "shifttracksession";

export async function loadSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" &&
      value !== null &&
      "token" in value &&
      "user" in value &&
      value.token === "abc123"
    ) {
      return value as Session;
    }
  } catch {
    /* Discard corrupt local session. */
  }
  await SecureStore.deleteItemAsync(KEY);
  return null;
}

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
