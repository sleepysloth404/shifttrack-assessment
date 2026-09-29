# ShiftTrack

A small Expo / React Native assessment app for staff to log in, view this week's shifts, record completed shifts, and clock in and out.

## Run

Requirements: Node.js 20 or newer, npm, and Expo Go on a phone or an iOS Simulator / Android Emulator.

```bash
npm install
npm start
```

Scan the QR code with Expo Go, or press `i` / `a` for a running simulator. The app is intended for iOS and Android.

**Demo login:** `staff@shifttrack.test` / `Password123`. The login screen can fill these values for a quick demo. Wrong credentials show a specific error.

## Five-minute walkthrough

1. Sign in and show the initial empty week. The week starts Monday in the device's local time zone.
2. Tap **Add completed shift**, select a day, enter start/end times in 24-hour format and a break in minutes, then save. Try an end time before the start to show validation.
3. Tap **Start shift now**, background or fully close the app, reopen it, and show that the elapsed timer continues from its saved timestamp. Tap **End shift** and confirm.
4. Tap **Demo: make next request fail**. The next weekly GET fails once; tap **Try again** to recover.
5. Log out and demonstrate session removal. Log in again; the saved shifts remain.

## Structure and decisions

- `App.tsx`: small screens and UI states. A synchronous ref lock guards every mutation before React rerenders, preventing duplicate taps.
- `src/api/mockApi.ts`: asynchronous in-app stand-in for `POST /auth/login`, `GET /shifts?weekStart=YYYY-MM-DD`, `POST /shifts`, and `PATCH /shifts/:id`. It adds a short delay and a one-shot failure switch for a visible retry path. Shifts persist in AsyncStorage to make the demo usable offline across restarts.
- `src/auth/session.ts`: stores the mock token and user in Expo SecureStore, restores them on launch, and removes them on logout. Passwords are never saved. The embedded demo credential and token are **public mock fixtures**, not production secrets or real authentication.
- `src/domain/time.ts`: local calendar week, input parsing, display formatting, and net worked duration. Timestamps are saved as ISO instants. The live timer derives from `Date.now - startTime`, rather than counting ticks, so backgrounding and restarting do not lose elapsed time. Completed duration subtracts the unpaid break.

The mock is intentionally local: data belongs to the device and is not synchronized. For a production backend, replace the API module, use server-issued expiring tokens and refresh handling, enforce authorization and validation server-side, and add an offline sync policy.

## Checks

```bash
npm test
npm run typecheck
npx expo export --platform android
```

## Next

Add edit/delete, overlapping-shift validation, an explicit break workflow for live shifts, week navigation, and focused tests around time zones and midnight. The local mock includes a helper to recover an active shift across a week boundary.

## Submission checklist

- Push this folder to a GitHub repository (public, or private with `JeetDas5` added as a collaborator).
- Record the walkthrough above in a roughly five-minute Loom video on your own computer/device.
- Email `info@nexbrix.com.au` with subject `ShiftTrack Assessment - [Your Name]`, including the GitHub and Loom links. Replace the name placeholder before sending.
