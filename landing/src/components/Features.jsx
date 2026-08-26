import { motion } from "framer-motion";

const FEATURES = [
  {
    icon: "🫧",
    title: "Always there, never in the way",
    body: "Docks to a screen edge and stays on top of every app, on every virtual desktop — a tap away, out of your way otherwise.",
  },
  {
    icon: "🔒",
    title: "100% local",
    body: "No account, no server, no telemetry. Your todos are stored on your machine and never leave it.",
  },
  {
    icon: "⚡",
    title: "Instant open/close",
    body: "One click expands it into a full list right where the bubble sits. Click away and it snaps back to just the bubble.",
  },
  {
    icon: "🧲",
    title: "Remembers where you left it",
    body: "Position, expanded state, and every todo persist across restarts — pick up exactly where you left off.",
  },
  {
    icon: "🖱️",
    title: "Drag to reorder",
    body: "Reorder, complete, and delete todos with simple drag-and-drop and one-click interactions.",
  },
  {
    icon: "🖥️",
    title: "Tray icon fallback",
    body: "Show or hide the bubble, launch at login, or quit — all from a lightweight system tray menu.",
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
          Why it's different
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
