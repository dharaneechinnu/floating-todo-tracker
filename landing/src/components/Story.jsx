import { motion } from "framer-motion";

const BEATS = [
  {
    n: "01",
    kicker: "The problem",
    title: "Your todo list lives in a tab you forgot.",
    body: "It's behind twelve other windows. Checking it means a context switch, and every context switch costs you your flow. Then standup arrives and you're scrambling to remember what you actually did yesterday.",
    points: ["Out of sight, out of mind", "Alt-Tab just to check what's next", "Standup by memory"],
  },
  {
    n: "02",
    kicker: "What it is",
    title: "A tiny bubble that's always there.",
    body: "FocusDock is a small circle that floats on top of every window, on every virtual desktop. Click it and your list opens right where it sits. Click ✕ and it's a bubble again.",
    points: ["Always on top, every desktop", "Opens in place, no app to find", "Windows & Linux, free"],
  },
  {
    n: "03",
    kicker: "Why it's different",
    title: "Impossible to forget, impossible to be in the way.",
    body: "Drag it to any screen edge and it docks there, peeking out just enough to reach while the rest tucks past the edge. It never covers your work. And it's local-first: no account, no server, no telemetry.",
    points: ["Docks & peeks ~30% from any edge", "Never covers what you're doing", "100% local, nothing leaves your machine"],
  },
  {
    n: "04",
    kicker: "Who it's for",
    title: "Engineers tracking real work.",
    body: "Tag a task with the PR it ships in, flag what's blocked, set priority and due dates, run focus sessions on the task in front of you, and copy a ready-made standup report when you log off.",
    points: ["PR numbers & blockers", "Focus timer with 🍅 per task", "One-click login/logout report"],
  },
];

const card = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export default function Story() {
  return (
    <section id="story" className="story">
      <div className="wrap">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.5 }}
        >
          Why this exists
        </motion.h2>
        <motion.ol
          className="story-grid"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          transition={{ staggerChildren: 0.1 }}
        >
          {BEATS.map((b) => (
            <motion.li className="story-card" variants={card} key={b.n}>
              <div className="story-top">
                <span className="story-n">{b.n}</span>
                <span className="story-kicker">{b.kicker}</span>
              </div>
              <h3>{b.title}</h3>
              <p>{b.body}</p>
              <ul>
                {b.points.map((pt) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
