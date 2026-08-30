/*
 * Pomodoro focus timer logic. Pure functions, no DOM or IPC — same shape as
 * taskMeta.js and logoutReport.js.
 *
 * Follows Francesco Cirillo's original technique: 25 minutes of focused work,
 * a 5-minute break, and a longer 15-minute break after every fourth focus
 * session. The rule that "an interrupted pomodoro is void" is what decides
 * how a session that outlived the app is handled — see voidsOnRestart below.
 */

export const FOCUS_MINUTES = 25;
export const SHORT_BREAK_MINUTES = 5;
export const LONG_BREAK_MINUTES = 15;
export const SESSIONS_BEFORE_LONG_BREAK = 4;

export const PHASES = {
  focus: {
    id: "focus",
    label: "Focus",
    minutes: FOCUS_MINUTES,
    done: "Focus session done",
  },
  short: {
    id: "short",
    label: "Short break",
    minutes: SHORT_BREAK_MINUTES,
    done: "Break over",
  },
  long: {
    id: "long",
    label: "Long break",
    minutes: LONG_BREAK_MINUTES,
    done: "Long break over",
  },
};

export const PHASE_IDS = Object.keys(PHASES);

export function isPhase(id) {
  return Object.prototype.hasOwnProperty.call(PHASES, id);
}

export function phaseMinutes(id) {
  return isPhase(id) ? PHASES[id].minutes : FOCUS_MINUTES;
}

export function phaseDurationMs(id) {
  return phaseMinutes(id) * 60_000;
}

/*
 * What comes after the phase that just finished.
 *
 * `completedFocusSessions` is the running count *including* the session that
 * just ended, so every fourth one earns the long break. A break is always
 * followed by focus.
 */
export function nextPhase(finishedPhase, completedFocusSessions) {
  if (finishedPhase !== "focus") return "focus";
  return completedFocusSessions > 0 &&
    completedFocusSessions % SESSIONS_BEFORE_LONG_BREAK === 0
    ? "long"
    : "short";
}

/*
 * Cirillo's rule: a pomodoro that gets interrupted is void, not partially
 * credited. Quitting the app mid-session is an interruption, so a focus
 * session never survives a restart. Breaks aren't the unit of work being
 * measured, so there's nothing to void — they just don't resume either.
 */
export function voidsOnRestart(phase) {
  return phase === "focus";
}

function clampMs(ms) {
  return Math.max(0, Math.round(ms));
}

/*
 * Remaining milliseconds for a stored session.
 *
 * A running session stores its `endsAt` wall-clock timestamp rather than a
 * countdown, so it stays accurate across a sleep/wake or a dropped tick —
 * decrementing a counter would silently drift. A paused session stores the
 * remainder it was frozen at instead, since it has no end time yet.
 */
export function remainingMs(session, now = Date.now()) {
  if (!session) return 0;
  if (!session.running) return clampMs(session.remainingMs || 0);
  return clampMs((session.endsAt || 0) - now);
}

export function isFinished(session, now = Date.now()) {
  return !!session && session.running && remainingMs(session, now) === 0;
}

export function elapsedRatio(session, now = Date.now()) {
  if (!session) return 0;
  const total = phaseDurationMs(session.phase);
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - remainingMs(session, now) / total));
}

/* Full clock for the panel: "24:07". */
export function formatClock(ms) {
  const total = Math.ceil(clampMs(ms) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/*
 * Compact form for the bubble badge.
 *
 * At rest the badge must fit the ~22px sliver of bubble the display hasn't
 * clipped — about 20px of usable width. "24:07" is far too wide, and even
 * "25m" measures 25.9px and hangs off the edge. So this is the bare minute
 * count (14.8px), with the unit carried by colour instead: orange or green
 * means a running timer, red means the pending-task count. The panel shows
 * the full clock and the bubble's aria-label spells it out.
 *
 * Rounded up so it never reads "0" with time still on the clock.
 */
export function formatBadge(ms) {
  const remaining = clampMs(ms);
  if (remaining === 0) return "0";
  return `${Math.ceil(remaining / 60_000)}`;
}

export function sessionLabel(session) {
  if (!session) return "";
  const phase = PHASES[session.phase];
  return phase ? phase.label : "";
}
