import AsyncStorage from "@react-native-async-storage/async-storage";
import { Shift } from "../domain/time";

export type Session = { token: string; user: { id: string; name: string } };

const TOKEN = "abc123"; // Public mock token, never a production credential.
const SHIFTS_KEY = "shifttrack:shifts:u1";
let failNextRequest = false;

export function simulateNextError(): void {
  failNextRequest = true;
}

async function request(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 450));
  if (failNextRequest) {
    failNextRequest = false;
    throw new Error("The mock service is unavailable. Please try again.");
  }
}

function authorize(token: string): void {
  if (token !== TOKEN)
    throw new Error("Your session has expired. Please sign in again.");
}

async function readShifts(): Promise<Shift[]> {
  const stored = await AsyncStorage.getItem(SHIFTS_KEY);
  if (!stored) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed))
    throw new Error("Could not read saved shifts. Please try again.");
  return parsed as Shift[];
}

export const api = {
  // POST /auth/login
  async login(email: string, password: string): Promise<Session> {
    await request();
    if (
      email.trim().toLowerCase() !== "staff@shifttrack.test" ||
      password !== "Password123"
    ) {
      throw new Error("Incorrect email or password. Please try again.");
    }
    return { token: TOKEN, user: { id: "u1", name: "Alex" } };
  },

  // GET /shifts?weekStart=YYYY-MM-DD
  async getShifts(token: string, weekStart: string): Promise<Shift[]> {
    await request();
    authorize(token);
    const start = new Date(`${weekStart}T00:00:00`);
    if (Number.isNaN(start.getTime())) throw new Error("Invalid week.");
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    return (await readShifts())
      .filter((shift) => shift.date >= weekStart && shift.date < endDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  },

  // Local mock helper for an active shift that began before this week.
  async getActiveShift(token: string): Promise<Shift | null> {
    await request();
    authorize(token);
    return (await readShifts()).find((shift) => !shift.endTime) ?? null;
  },

  // POST /shifts
  async createShift(token: string, input: Omit<Shift, "id">): Promise<Shift> {
    await request();
    authorize(token);
    const shifts = await readShifts();
    if (!input.endTime && shifts.some((shift) => !shift.endTime))
      throw new Error("End your active shift before starting another.");
    const shift = {
      ...input,
      id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
    await AsyncStorage.setItem(SHIFTS_KEY, JSON.stringify([...shifts, shift]));
    return shift;
  },

  // PATCH /shifts/:id
  async updateShift(
    token: string,
    id: string,
    patch: Pick<Shift, "endTime">,
  ): Promise<Shift> {
    await request();
    authorize(token);
    const shifts = await readShifts();
    const index = shifts.findIndex((shift) => shift.id === id);
    if (index < 0)
      throw new Error("Shift not found. Reload your shifts and try again.");
    if (shifts[index].endTime) throw new Error("This shift has already ended.");
    if (
      !patch.endTime ||
      new Date(patch.endTime).getTime() <=
        new Date(shifts[index].startTime).getTime()
    ) {
      throw new Error("End time must be after the start time.");
    }
    shifts[index] = { ...shifts[index], endTime: patch.endTime };
    await AsyncStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts));
    return shifts[index];
  },
};
