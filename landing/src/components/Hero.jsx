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
          <div className="eyebrow">🚀 Now available · Windows &amp; Linux · Free</div>
          <h1>
            A todo list that
            <br />
            lives <span className="accent-text">on top</span> of everything.
          </h1>
          <p className="sub">
            A small always-on-top bubble that floats over every window and every
            virtual desktop. Click it to open your list, click away and it
            collapses. Local-only — no account, no server, nothing to sync.
          </p>
          <div className="hero-ctas">
            <a href="#download" className="btn-primary">
              <span>⬇</span> Download free
            </a>
            <button className="btn-outline" onClick={onTakeTour}>
              ▶ Take the guided tour
            </button>
          </div>
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
