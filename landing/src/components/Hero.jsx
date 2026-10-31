import { motion } from "framer-motion";
import AppDemo from "./AppDemo.jsx";

export default function Hero({ refs, activeStepId, onStepReady, onTakeTour }) {
  return (
    <header className="hero" id="top">
      <div className="hero-glow" />
      <div className="hero-glow-2" />
      <div className="wrap hero-inner">
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="eyebrow">🚀 Launch · Free for Windows &amp; Linux</div>
          <h1>
            A todo list that
            <br />
            lives <span className="accent-text">on top</span> of everything.
          </h1>
          <p className="sub">
            Your list shouldn&rsquo;t live in a tab you forget. This one is a small
            bubble that docks to your screen edge and peeks out over every window,
            on every desktop. Track PRs, blockers and focus sessions, then copy your
            standup report in one click. Local-only, no account.
          </p>
          <div className="hero-ctas">
            <a href="#download" className="btn-primary">
              <span>⬇</span> Download free
            </a>
            <a href="#video" className="btn-outline">
              ▶ Watch the 90s film
            </a>
          </div>
          <button className="hero-tour-link" onClick={onTakeTour}>
            or take the interactive guided tour →
          </button>
          <div className="hero-trust">
            <span>🔒 100% local</span>
            <span>·</span>
            <span>🪶 ~80&nbsp;MB installer</span>
            <span>·</span>
            <span>🆓 Open source</span>
          </div>
        </motion.div>

        <motion.div
          id="demo"
          className="hero-demo"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        >
          <AppDemo refs={refs} activeStepId={activeStepId} onStepReady={onStepReady} />
        </motion.div>
      </div>
    </header>
  );
}
