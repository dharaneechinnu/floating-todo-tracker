import { priorityRank } from "./taskMeta.js";

function taskLabel(todo) {
  const body = todo.prNumber
    ? `Pull Request ${todo.prNumber}: ${todo.text}`
    : todo.text;
  // Priority leads and the deadline trails, so a reader scanning the
  // pasted report sees "how urgent" before the text and "by when" after.
  const priority = todo.priority ? `[${todo.priority.toUpperCase()}] ` : "";
  const due = todo.dueDate ? ` (due ${todo.dueDate})` : "";
  return `${priority}${body}${due}`;
}

function splitLines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

// Login and logout reports share the exact same shape — time header, task
// list, collaborations, blockers — the only difference is the header label
// and login's extra "Task for today" section at the end.
export function buildSessionReport(
  todos,
  { mode = "logout", collaborations = "", blockerNote = "", todayPlan = "", now = new Date() } = {}
) {
  const blocked = todos.filter((t) => t.blocked);
  const active = todos.filter((t) => !t.blocked);
  const completed = active.filter((t) => t.done);
  const inProgress = active.filter((t) => !t.done);

  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const label = mode === "login" ? "Login Time" : "Logout Time";

  const lines = [`🕘 ${label}: ${time} - ${date}`, ""];

  if (inProgress.length || completed.length) {
    lines.push("📋 Tasks:", "");
    // Highest priority first among the still-open work — whoever reads
    // the pasted update should hit the important items before scrolling.
    // Completed work keeps its own order and stays at the bottom.
    const ordered = [
      ...[...inProgress].sort((a, b) => priorityRank(a) - priorityRank(b)),
      ...completed,
    ];
    ordered.forEach((todo, index) => {
      const emoji = todo.done ? "✅" : "⚒️";
      lines.push(`${emoji} Task ${index + 1}: ${taskLabel(todo)}`);
      lines.push(`Status: ${todo.done ? "🟢 Completed" : "🟡 In Progress"}`);
      if (todo.feedback?.trim()) lines.push(`Feedback Required: ${todo.feedback.trim()}`);
      lines.push("");
    });
  }

  lines.push("🤝 Collaborations:");
  const collabLines = splitLines(collaborations);
  lines.push(...(collabLines.length ? collabLines.map((l) => `- ${l}`) : ["- None"]));
  lines.push("");

  lines.push("🚫 Blockers:");
  const blockerLines = [...blocked.map(taskLabel), ...splitLines(blockerNote)];
  lines.push(...(blockerLines.length ? blockerLines.map((l) => `- ${l}`) : ["- None"]));

  if (mode === "login") {
    lines.push("", "📝 Task for today:", "");
    const planLines = splitLines(todayPlan);
    lines.push(...(planLines.length ? planLines.map((l) => `- ${l}`) : ["- None"]));
  }

  return lines.join("\n").trim();
}
