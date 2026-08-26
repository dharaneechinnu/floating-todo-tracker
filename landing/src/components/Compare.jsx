import { motion } from "framer-motion";

const ROWS = [
  {
    label: "Where it lives",
    us: "Floats on top of every window, always visible",
    them: "Hidden in a browser tab or behind your app switcher",
  },
  {
    label: "Getting started",
    us: "Open the app — that's it",
    them: "Sign up, verify email, pick a plan",
  },
  {
    label: "Your data",
    us: "Stored only on your machine, never leaves it",
    them: "Uploaded to someone else's server by default",
  },
  {
    label: "Capturing a thought",
    us: "One click, type, enter — back to work in seconds",
    them: "Switch apps, wait for load, find the input, then type",
  },
  {
    label: "Cost",
    us: "Free, forever, open source",
    them: "Free tier capped, real features behind a paywall",
  },
  {
    label: "Account required",
    us: "Never",
    them: "Almost always",
  },
];

const row = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function Compare() {
  return (
    <section id="compare">
      <div className="wrap">
        <motion.div
          className="compare-head"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.5 }}
        >
          <h2>Not another todo app in a tab</h2>
          <p className="compare-sub">
            Most task managers ask you to open them. This one refuses to be forgotten.
          </p>
        </motion.div>

        <motion.div
          className="compare-table"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          transition={{ staggerChildren: 0.07 }}
        >
          <div className="compare-row compare-legend">
            <div className="compare-label" />
            <div className="compare-us-head">🫧 Floating Todo Tracker</div>
            <div className="compare-them-head">Typical todo apps</div>
          </div>
          {ROWS.map((r) => (
            <motion.div className="compare-row" variants={row} key={r.label}>
              <div className="compare-label">{r.label}</div>
              <div className="compare-us">
                <span className="check">✓</span> {r.us}
              </div>
              <div className="compare-them">
                <span className="cross">×</span> {r.them}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
