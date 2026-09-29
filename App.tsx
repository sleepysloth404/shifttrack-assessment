import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { api, Session, simulateNextError } from "./src/api/mockApi";
import { clearSession, loadSession, saveSession } from "./src/auth/session";
import {
  atLocalTime,
  clock,
  dayLabel,
  duration,
  elapsedClock,
  localDate,
  Shift,
  weekDates,
  workedMinutes,
} from "./src/domain/time";

const c = {
  ink: "#182332",
  muted: "#687687",
  bg: "#F5F7F5",
  white: "#FFFFFF",
  green: "#18715B",
  pale: "#E8F4EC",
  border: "#E3E9E6",
  red: "#B34540",
  redBg: "#FFF0ED",
  lime: "#D7F48B",
};
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";

function Button({
  title,
  onPress,
  busy = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        busy && s.disabled,
        pressed && s.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? c.green : c.white} />
      ) : (
        <Text style={[s.buttonText, secondary && s.secondaryText]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
function ErrorNotice({ text, retry }: { text: string; retry?: () => void }) {
  return (
    <View style={s.errorBox} accessibilityRole="alert">
      <Text style={s.errorTitle}>Something went wrong</Text>
      <Text style={s.errorDetail}>{text}</Text>
      {retry && (
        <Pressable accessibilityRole="button" onPress={retry}>
          <Text style={s.retry}>Try again →</Text>
        </Pressable>
      )}
    </View>
  );
}
function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function submit() {
    if (lock.current) return;
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const session = await api.login(email, password);
      await saveSession(session);
      onLogin(session);
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={s.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={s.loginContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.brandMark}>
          <Text style={s.brandMarkText}>S</Text>
        </View>
        <Text style={s.eyebrow}>SHIFTTRACK · STAFF</Text>
        <Text style={s.loginHeading}>Your workday,{"\n"}in clear view.</Text>
        <Text style={s.subheading}>
          Sign in to see your week and track your time.
        </Text>
        <View style={s.card}>
          <Text style={s.label}>EMAIL ADDRESS</Text>
          <TextInput
            accessibilityLabel="Email address"
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="name@company.com"
            placeholderTextColor="#9AA5AA"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
          />
          <Text style={s.label}>PASSWORD</Text>
          <TextInput
            accessibilityLabel="Password"
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor="#9AA5AA"
            secureTextEntry
            textContentType="password"
            onSubmitEditing={submit}
            returnKeyType="go"
          />
          {error ? (
            <Text accessibilityRole="alert" style={s.inlineError}>
              {error}
            </Text>
          ) : null}
          <Button title="Sign in" onPress={submit} busy={busy} />
        </View>
        <Text style={s.demoHint}>DEMO ACCOUNT</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setEmail("staff@shifttrack.test");
            setPassword("Password123");
            setError("");
          }}
        >
          <Text style={s.demoLink}>Fill test credentials ↗</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function CreateShift({
  days,
  busy,
  error,
  onClose,
  onCreate,
}: {
  days: Date[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onCreate: (shift: Omit<Shift, "id">) => Promise<void>;
}) {
  const today = localDate(new Date());
  const [date, setDate] = useState(
    days.some((d) => localDate(d) === today) ? today : localDate(days[0]),
  );
  const [start, setStart] = useState("09:00"),
    [end, setEnd] = useState("17:00"),
    [breakText, setBreakText] = useState("30"),
    [validation, setValidation] = useState("");
  const lock = useRef(false);
  async function submit() {
    if (lock.current || busy) return;
    const from = atLocalTime(date, start.trim()),
      to = atLocalTime(date, end.trim()),
      breakMinutes = Number(breakText.trim());
    if (!from || !to) {
      setValidation("Use a valid 24-hour time, such as 09:00 or 17:30.");
      return;
    }
    if (to <= from) {
      setValidation("End time must be after start time.");
      return;
    }
    if (
      !/^\d+$/.test(breakText.trim()) ||
      breakMinutes >= (to.getTime() - from.getTime()) / 60000
    ) {
      setValidation(
        "Break must be a whole number of minutes shorter than the shift.",
      );
      return;
    }
    setValidation("");
    lock.current = true;
    try {
      await onCreate({
        date,
        startTime: from.toISOString(),
        endTime: to.toISOString(),
        breakMinutes,
      });
    } finally {
      lock.current = false;
    }
  }
  return (
    <KeyboardAvoidingView
      style={s.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={s.page}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable accessibilityRole="button" onPress={onClose} style={s.back}>
          <Text style={s.backText}>← This week</Text>
        </Pressable>
        <Text style={s.eyebrow}>NEW ENTRY</Text>
        <Text style={s.heading}>Add a shift</Text>
        <Text style={s.subheading}>
          Record a completed shift for this week.
        </Text>
        <Text style={s.label}>SHIFT DATE</Text>
        <View style={s.days}>
          {days.map((day) => {
            const key = localDate(day),
              selected = date === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={dayLabel(day)}
                accessibilityState={{ selected }}
                onPress={() => setDate(key)}
                style={[s.day, selected && s.daySelected]}
              >
                <Text style={[s.dayName, selected && s.daySelectedText]}>
                  {day.toLocaleDateString(undefined, { weekday: "short" })}
                </Text>
                <Text style={[s.dayNumber, selected && s.daySelectedText]}>
                  {day.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={s.card}>
          <Text style={s.label}>START TIME · 24-HOUR</Text>
          <TextInput
            accessibilityLabel="Start time"
            style={s.input}
            value={start}
            onChangeText={setStart}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <Text style={s.label}>END TIME · 24-HOUR</Text>
          <TextInput
            accessibilityLabel="End time"
            style={s.input}
            value={end}
            onChangeText={setEnd}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <Text style={s.label}>UNPAID BREAK · MINUTES</Text>
          <TextInput
            accessibilityLabel="Break minutes"
            style={s.input}
            value={breakText}
            onChangeText={setBreakText}
            keyboardType="number-pad"
            maxLength={4}
          />
          {validation || error ? (
            <Text accessibilityRole="alert" style={s.inlineError}>
              {validation || error}
            </Text>
          ) : null}
          <Button title="Save shift" onPress={submit} busy={busy} />
        </View>
        <Text style={s.helper}>Times use your device's local time zone.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function Dashboard({
  session,
  onLogout,
}: {
  session: Session;
  onLogout: () => Promise<void>;
}) {
  const [shifts, setShifts] = useState<Shift[]>([]),
    [activeShift, setActiveShift] = useState<Shift | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(false),
    [now, setNow] = useState(new Date());
  const lock = useRef(false),
    days = weekDates(now),
    weekStart = localDate(days[0]);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const week = await api.getShifts(session.token, weekStart);
      const active = await api.getActiveShift(session.token);
      setShifts(week);
      setActiveShift(active);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [session.token, weekStart]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setNow(new Date());
        void refresh();
      }
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [refresh]);
  async function runAction(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError("");
    try {
      await task();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const active = activeShift ?? shifts.find((shift) => !shift.endTime),
    completed = shifts.filter((shift) => !!shift.endTime);
  const total = completed.reduce((sum, shift) => sum + workedMinutes(shift), 0);
  async function create(input: Omit<Shift, "id">) {
    await runAction(async () => {
      const shift = await api.createShift(session.token, input);
      setShifts((current) =>
        [...current, shift].sort((a, b) =>
          a.startTime.localeCompare(b.startTime),
        ),
      );
      setCreating(false);
    });
  }
  async function start() {
    await runAction(async () => {
      const date = new Date();
      const shift = await api.createShift(session.token, {
        date: localDate(date),
        startTime: date.toISOString(),
        endTime: null,
        breakMinutes: 0,
      });
      setShifts((current) => [...current, shift]);
      setActiveShift(shift);
    });
  }
  function confirmEnd() {
    if (!active || busy) return;
    Alert.alert("End this shift?", "Your worked time will be saved.", [
      { text: "Keep tracking", style: "cancel" },
      {
        text: "End shift",
        onPress: () =>
          void runAction(async () => {
            const updated = await api.updateShift(session.token, active.id, {
              endTime: new Date().toISOString(),
            });
            setShifts((current) =>
              current.map((shift) =>
                shift.id === updated.id ? updated : shift,
              ),
            );
            setActiveShift(null);
          }),
      },
    ]);
  }
  if (creating)
    return (
      <CreateShift
        days={days}
        busy={busy}
        error={actionError}
        onClose={() => {
          if (!busy) {
            setCreating(false);
            setActionError("");
          }
        }}
        onCreate={create}
      />
    );
  return (
    <ScrollView contentContainerStyle={s.page}>
      <View style={s.topRow}>
        <View>
          <Text style={s.logo}>
            shift<Text style={s.logoAccent}>track.</Text>
          </Text>
          <Text style={s.greeting}>Good day, {session.user.name}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log out"
          onPress={() => void onLogout()}
          style={s.logout}
        >
          <Text style={s.logoutText}>Log out</Text>
        </Pressable>
      </View>
      <View style={s.weekHeader}>
        <View>
          <Text style={s.eyebrow}>YOUR SCHEDULE</Text>
          <Text style={s.heading}>This week</Text>
          <Text style={s.subheading}>
            {dayLabel(days[0])} – {dayLabel(days[6])}
          </Text>
        </View>
        <View style={s.weekBadge}>
          <Text style={s.weekBadgeText}>MON</Text>
        </View>
      </View>
      {active && (
        <View style={s.activeCard}>
          <View style={s.activeHeader}>
            <View style={s.livePill}>
              <View style={s.liveDot} />
              <Text style={s.liveText}>ON THE CLOCK</Text>
            </View>
            <Text style={s.activeDate}>
              {dayLabel(new Date(active.startTime))}
            </Text>
          </View>
          <Text style={s.timer}>
            {elapsedClock(now.getTime() - new Date(active.startTime).getTime())}
          </Text>
          <Text style={s.timerCaption}>
            Elapsed since {clock(active.startTime)} · live
          </Text>
          <Button
            title="End shift"
            onPress={confirmEnd}
            busy={busy}
            secondary
          />
        </View>
      )}
      <View style={s.summaryCard}>
        <View>
          <Text style={s.summaryLabel}>COMPLETED HOURS</Text>
          <Text style={s.summaryValue}>{duration(total)}</Text>
        </View>
        <View style={s.summaryDivider} />
        <View>
          <Text style={s.summaryLabel}>SHIFTS</Text>
          <Text style={s.summaryValue}>{completed.length}</Text>
        </View>
      </View>
      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>Shift history</Text>
        <Text style={s.sectionCount}>{shifts.length} this week</Text>
      </View>
      {loading ? (
        <View style={s.stateCard}>
          <ActivityIndicator color={c.green} />
          <Text style={s.stateText}>Loading your shifts…</Text>
        </View>
      ) : error ? (
        <ErrorNotice text={error} retry={() => void refresh()} />
      ) : shifts.length === 0 ? (
        <View style={s.stateCard}>
          <View style={s.emptyIcon}>
            <Text style={s.emptyIconText}>◷</Text>
          </View>
          <Text style={s.emptyTitle}>A fresh week starts here</Text>
          <Text style={s.stateText}>
            No shifts yet. Start tracking now or add a completed shift.
          </Text>
        </View>
      ) : (
        shifts
          .slice()
          .reverse()
          .map((shift) => (
            <View key={shift.id} style={s.shiftCard}>
              <View style={s.shiftDateBlock}>
                <Text style={s.shiftDay}>
                  {new Date(shift.startTime)
                    .toLocaleDateString(undefined, { weekday: "short" })
                    .toUpperCase()}
                </Text>
                <Text style={s.shiftNumber}>
                  {new Date(shift.startTime).getDate()}
                </Text>
              </View>
              <View style={s.shiftDetails}>
                <Text style={s.shiftTitle}>
                  {clock(shift.startTime)} –{" "}
                  {shift.endTime ? clock(shift.endTime) : "In progress"}
                </Text>
                <Text style={s.shiftMeta}>
                  {shift.breakMinutes} min break ·{" "}
                  {shift.endTime
                    ? duration(workedMinutes(shift))
                    : "Active shift"}
                </Text>
              </View>
            </View>
          ))
      )}
      {actionError && (
        <ErrorNotice
          text={actionError}
          retry={() => {
            setActionError("");
            void refresh();
          }}
        />
      )}
      {!active && (
        <Button
          title="◉  Start shift now"
          onPress={() => void start()}
          busy={busy}
        />
      )}
      <View style={s.spacer} />
      <Button
        title="＋  Add completed shift"
        onPress={() => {
          setActionError("");
          setCreating(true);
        }}
        secondary
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          simulateNextError();
          void refresh();
        }}
        style={s.demoError}
      >
        <Text style={s.demoErrorText}>Demo: make next request fail</Text>
      </Pressable>
    </ScrollView>
  );
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [booting, setBooting] = useState(true),
    [bootError, setBootError] = useState("");
  const restore = useCallback(async () => {
    setBooting(true);
    setBootError("");
    try {
      setSession(await loadSession());
    } catch (e) {
      setBootError(errorText(e));
    } finally {
      setBooting(false);
    }
  }, []);
  useEffect(() => {
    void restore();
  }, [restore]);
  async function logout() {
    try {
      await clearSession();
      setSession(null);
    } catch (e) {
      Alert.alert("Could not log out", errorText(e));
    }
  }
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <StatusBar barStyle="dark-content" backgroundColor={c.bg} />
        {booting ? (
          <View style={s.boot}>
            <ActivityIndicator color={c.green} />
            <Text style={s.stateText}>Opening ShiftTrack…</Text>
          </View>
        ) : bootError ? (
          <View style={s.boot}>
            <ErrorNotice text={bootError} retry={() => void restore()} />
          </View>
        ) : session ? (
          <Dashboard session={session} onLogout={logout} />
        ) : (
          <Login onLogin={setSession} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, backgroundColor: c.bg },
  page: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 48 },
  boot: { flex: 1, justifyContent: "center", padding: 24, gap: 16 },
  button: {
    backgroundColor: c.green,
    minHeight: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  buttonText: { color: c.white, fontWeight: "700", fontSize: 16 },
  secondary: {
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.border,
  },
  secondaryText: { color: c.green },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.76 },
  brandMark: {
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: c.green,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 26,
  },
  brandMarkText: { color: c.lime, fontSize: 29, fontWeight: "900" },
  loginContent: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 70,
    paddingBottom: 35,
  },
  eyebrow: {
    color: c.green,
    fontSize: 11,
    letterSpacing: 1.8,
    fontWeight: "800",
    marginBottom: 7,
  },
  loginHeading: {
    color: c.ink,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1.4,
    lineHeight: 42,
  },
  heading: { color: c.ink, fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  subheading: {
    color: c.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 9,
    marginBottom: 28,
  },
  card: {
    backgroundColor: c.white,
    borderRadius: 24,
    padding: 20,
    gap: 9,
    borderWidth: 1,
    borderColor: c.border,
  },
  label: {
    color: c.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 7,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: "#FAFCFA",
    borderRadius: 13,
    paddingHorizontal: 15,
    color: c.ink,
    fontSize: 16,
    marginBottom: 9,
  },
  inlineError: { color: c.red, fontSize: 14, lineHeight: 20, marginBottom: 4 },
  demoHint: {
    color: c.muted,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 32,
  },
  demoLink: {
    color: c.green,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
    padding: 8,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  logo: { fontSize: 25, fontWeight: "900", color: c.ink, letterSpacing: -1.2 },
  logoAccent: { color: c.green },
  greeting: { color: c.muted, fontSize: 13, marginTop: 4 },
  logout: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: c.white,
  },
  logoutText: { color: c.muted, fontWeight: "700", fontSize: 12 },
  weekHeader: {
    marginTop: 36,
    marginBottom: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  weekBadge: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: c.pale,
    alignItems: "center",
    justifyContent: "center",
  },
  weekBadgeText: { color: c.green, fontSize: 11, fontWeight: "800" },
  activeCard: {
    backgroundColor: c.green,
    padding: 22,
    borderRadius: 24,
    marginBottom: 15,
  },
  activeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  livePill: {
    backgroundColor: "#2E876B",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 7,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.lime },
  liveText: {
    color: c.white,
    fontWeight: "800",
    fontSize: 10,
    letterSpacing: 1,
  },
  activeDate: { color: "#C7E8D8", fontSize: 12 },
  timer: {
    color: c.white,
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1.5,
    marginTop: 21,
    fontVariant: ["tabular-nums"],
  },
  timerCaption: {
    color: "#C8E7DA",
    fontSize: 13,
    marginTop: 2,
    marginBottom: 22,
  },
  summaryCard: {
    backgroundColor: c.white,
    borderRadius: 21,
    padding: 22,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.border,
  },
  summaryLabel: {
    color: c.muted,
    fontSize: 10,
    letterSpacing: 1.1,
    fontWeight: "800",
  },
  summaryValue: { color: c.ink, fontSize: 24, fontWeight: "800", marginTop: 8 },
  summaryDivider: {
    width: 1,
    height: 45,
    backgroundColor: c.border,
    marginHorizontal: 25,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 32,
    marginBottom: 14,
  },
  sectionTitle: { color: c.ink, fontSize: 20, fontWeight: "800" },
  sectionCount: { color: c.muted, fontSize: 12 },
  stateCard: {
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 21,
    minHeight: 170,
    padding: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  stateText: {
    color: c.muted,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: c.pale,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyIconText: { color: c.green, fontSize: 27 },
  emptyTitle: { color: c.ink, fontSize: 16, fontWeight: "800" },
  errorBox: {
    backgroundColor: c.redBg,
    borderRadius: 18,
    padding: 19,
    marginBottom: 18,
  },
  errorTitle: { color: c.red, fontSize: 16, fontWeight: "800" },
  errorDetail: { color: c.red, fontSize: 14, lineHeight: 20, marginTop: 5 },
  retry: { color: c.red, fontWeight: "800", marginTop: 13, fontSize: 14 },
  shiftCard: {
    backgroundColor: c.white,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: c.border,
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    marginBottom: 10,
  },
  shiftDateBlock: {
    backgroundColor: c.pale,
    borderRadius: 12,
    width: 51,
    height: 53,
    alignItems: "center",
    justifyContent: "center",
  },
  shiftDay: { color: c.green, fontSize: 10, fontWeight: "800" },
  shiftNumber: {
    color: c.green,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 23,
  },
  shiftDetails: { flex: 1, marginLeft: 13 },
  shiftTitle: { color: c.ink, fontSize: 14, fontWeight: "800" },
  shiftMeta: { color: c.muted, fontSize: 12, marginTop: 5 },
  spacer: { height: 9 },
  demoError: { alignSelf: "center", padding: 14, marginTop: 14 },
  demoErrorText: {
    color: c.muted,
    fontSize: 12,
    textDecorationLine: "underline",
  },
  back: { paddingVertical: 12, alignSelf: "flex-start", marginBottom: 25 },
  backText: { color: c.green, fontSize: 15, fontWeight: "700" },
  days: { flexDirection: "row", gap: 5, marginTop: 12, marginBottom: 24 },
  day: {
    flex: 1,
    backgroundColor: c.white,
    borderRadius: 13,
    paddingVertical: 11,
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.border,
  },
  daySelected: { backgroundColor: c.green, borderColor: c.green },
  dayName: { color: c.muted, fontSize: 10, fontWeight: "700" },
  dayNumber: { color: c.ink, fontSize: 16, fontWeight: "800", marginTop: 5 },
  daySelectedText: { color: c.white },
  helper: { color: c.muted, fontSize: 12, textAlign: "center", marginTop: 20 },
});
