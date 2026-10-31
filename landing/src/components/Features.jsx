import { motion } from "framer-motion";

const FEATURES = [
  {
    icon: "🫧",
    title: "Docks & peeks from any edge",
    body: "Drag the bubble anywhere; on release it snaps to the nearest screen edge and rests there showing just a sliver. Multi-monitor aware.",
  },
  {
    icon: "🔎",
    title: "Type to search, Enter to add",
    body: "The add box filters your list as you type. Only when nothing matches does Enter create a new todo, so near-duplicates don't pile up.",
  },
  {
    icon: "🔀",
    title: "PR numbers & blockers",
    body: "Tag a task with its pull request and flag it blocked. Both show as compact chips on the row and flow into your report.",
  },
  {
    icon: "🎯",
    title: "Priority & due dates",
    body: "P0–P3 chips and due chips (Today, Tomorrow, 3d late). Overdue tasks get a red rail so they can't hide in a long list.",
  },
  {
    icon: "🍅",
    title: "Focus timer per task",
    body: "Hit ▶ on a row for a 25-minute focus session. It keeps running while the panel is collapsed, and each finished session earns that task a 🍅.",
  },
  {
    icon: "📋",
    title: "One-click standup report",
    body: "Build a login/logout status report (tasks, collaborations, blockers, today's plan) and copy it straight to your clipboard.",
  },
  {
    icon: "☑️",
    title: "Bulk select, rename, reorder",
    body: "Select many and complete or delete them at once, double-click to rename in place, drag to reorder, clear completed.",
  },
  {
    icon: "🔒",
    title: "100% local",
    body: "No account, no server, no telemetry. Todos, dock position and timers persist on your machine across restarts.",
  },
  {
    icon: "🖥️",
    title: "Tray icon fallback",
    body: "Show or hide the bubble, launch at login, or quit, all from a lightweight system tray menu.",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

export default function Features() {
  return (
    <section id="features">
      <div className="wrap">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.5 }}
        >
          Everything inside the bubble
        </motion.h2>
        <motion.div
          className="features"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          {FEATURES.map((f) => (
            <motion.div className="feature" variants={item} key={f.title} whileHover={{ y: -4 }}>
              <div className="icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
