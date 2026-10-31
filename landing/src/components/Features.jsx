import Icon from "./Icon.jsx";

const FEATURES = [
  { icon: "move", c: "orange", size: "wide", title: "Docks and peeks from any edge", body: "Drag the bubble anywhere. When you let go it snaps to the nearest screen edge and rests there showing just a sliver. It's multi-monitor aware, so it never peeks onto a neighbouring screen." },
  { icon: "search", c: "blue", title: "Type to search, Enter to add", body: "The add box filters as you type. Enter only creates a todo when nothing matches, so near-duplicates don't pile up." },
  { icon: "git-pull-request", c: "purple", title: "PR numbers and blockers", body: "Tag a task with its pull request and flag it blocked. Both show as compact chips and flow into your report." },
  { icon: "calendar", c: "green", title: "Priority and due dates", body: "P0–P3 chips and due chips (Today, Tomorrow, 3d late). Overdue rows get a red rail so they can't hide." },
  { icon: "timer", c: "red", size: "tall", title: "A focus timer on every task", body: "Hit ▶ on a row for a 25-minute session. It keeps running while the panel is collapsed, and every session you finish earns that task a 🍅." },
  { icon: "clipboard-check", c: "yellow", title: "One-click standup report", body: "A login or logout report with tasks, collaborations, blockers and today's plan, copied straight to your clipboard." },
  { icon: "list-checks", c: "blue", title: "Bulk select, rename, reorder", body: "Complete or delete many at once, double-click to rename in place, drag to reorder, clear what's done." },
  { icon: "lock", c: "green", title: "100% local", body: "No account, no server, no telemetry. Your todos, dock position and timers stay on your machine across restarts." },
  { icon: "panel-right", c: "purple", size: "wide", title: "Tray icon as a safety net", body: "Show or hide the bubble, turn launch-at-login on or off, or quit, all from a lightweight system tray menu." },
];

export default function Features() {
  return (
    <section className="section features" id="features">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <span className="kicker">Everything inside the bubble</span>
          <h2>Small on screen. Serious about your work.</h2>
        </div>
        <div className="bento">
          {FEATURES.map((f) => (
            <article className={`feature c-${f.c}${f.size ? " " + f.size : ""}`} key={f.title} data-reveal>
              <span className="feature-icon">
                <Icon name={f.icon} size={24} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
