// Priority and due-date logic for a task. Pure functions with no DOM or
// IPC dependency, same as logoutReport.js — everything here is decided
// from a todo object plus "now".

export const PRIORITIES = [
  { id: "p0", label: "P0", title: "Critical — drop everything" },
  { id: "p1", label: "P1", title: "High — this sprint" },
  { id: "p2", label: "P2", title: "Medium — planned" },
  { id: "p3", label: "P3", title: "Low — nice to have" },
];

export const PRIORITY_IDS = PRIORITIES.map((p) => p.id);

const PRIORITY_RANK = { p0: 0, p1: 1, p2: 2, p3: 3 };
const UNSET_RANK = 99;

const MS_PER_DAY = 86400000;

export function priorityRank(todo) {
  const rank = PRIORITY_RANK[todo && todo.priority];
  return rank === undefined ? UNSET_RANK : rank;
}

/*
 * Parse "YYYY-MM-DD" as LOCAL midnight.
 *
 * `new Date("2026-03-03")` is specified to parse as *UTC* midnight, which
 * anywhere west of Greenwich is the evening of the 2nd in local time — so
 * a task would read as overdue a full day early. Constructing the date
 * from its parts avoids that entirely.
 */
export function parseDueDate(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  // Date silently rolls impossible values over (Feb 31 -> Mar 3), so
  // check the parts survived the round trip.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function isValidDueDate(value) {
  return value === "" || parseDueDate(value) !== null;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/*
 * Whole days from today to the due date: negative is late, 0 is today.
 * Both sides are snapped to local midnight and the result rounded, so a
 * 23- or 25-hour DST day still counts as exactly one day.
 */
export function daysUntilDue(dueDate, now = new Date()) {
  const due = parseDueDate(dueDate);
  if (!due) return null;
  return Math.round((due - startOfDay(now)) / MS_PER_DAY);
}

// null when there's nothing to signal — no due date, or already done.
export function dueStatus(todo, now = new Date()) {
  if (!todo || todo.done) return null;
  const days = daysUntilDue(todo.dueDate, now);
  if (days === null) return null;
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return "later";
}

export function dueLabel(dueDate, now = new Date()) {
  const days = daysUntilDue(dueDate, now);
  if (days === null) return "";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return `${Math.abs(days)}d late`;
  const due = parseDueDate(dueDate);
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function byCreatedAt(a, b) {
  return (a.createdAt || 0) - (b.createdAt || 0);
}

// Done tasks always sink in a sorted view — you're sorting to decide what
// to do next, and finished work is never the answer.
function byDoneThen(compare) {
  return (a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    return compare(a, b);
  };
}

const comparePriority = byDoneThen((a, b) => {
  const diff = priorityRank(a) - priorityRank(b);
  return diff !== 0 ? diff : byCreatedAt(a, b);
});

const compareDue = byDoneThen((a, b) => {
  const da = daysUntilDue(a.dueDate);
  const db = daysUntilDue(b.dueDate);
  // Undated tasks sink below dated ones rather than sorting as "day zero".
  if (da === null && db === null) return byCreatedAt(a, b);
  if (da === null) return 1;
  if (db === null) return -1;
  if (da !== db) return da - db;
  return priorityRank(a) - priorityRank(b);
});

export const SORTS = [
  { id: "manual", label: "Manual", title: "Your drag order" },
  { id: "priority", label: "Priority", title: "P0 first" },
  { id: "due", label: "Due", title: "Soonest deadline first" },
];

export const SORT_IDS = SORTS.map((s) => s.id);

// "manual" returns the array untouched so drag-order stays authoritative.
export function sortTodos(todos, sortId) {
  if (sortId === "priority") return [...todos].sort(comparePriority);
  if (sortId === "due") return [...todos].sort(compareDue);
  return todos;
}

export const FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "overdue", label: "Late" },
  { id: "high", label: "P0–P1" },
];

export const FILTER_IDS = FILTERS.map((f) => f.id);

export function matchesFilter(todo, filterId, now = new Date()) {
  switch (filterId) {
    case "open":
      return !todo.done;
    case "overdue":
      return dueStatus(todo, now) === "overdue";
    case "high":
      return !todo.done && (todo.priority === "p0" || todo.priority === "p1");
    default:
      return true;
  }
}
