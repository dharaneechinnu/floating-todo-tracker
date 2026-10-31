import { useRef, useState } from "react";
import { motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL;
const VIDEO_SRC = `${BASE}launch-video.mp4`;
const POSTER_SRC = `${BASE}launch-poster.jpg`;

// Chapter start times match the narration segments the video was cut to.
const CHAPTERS = [
  { t: 0, label: "The problem" },
  { t: 16.4, label: "What it is" },
  { t: 23.9, label: "Why it's different" },
  { t: 39.5, label: "Who it's for" },
  { t: 47.4, label: "Walkthrough" },
  { t: 78.1, label: "Get it" },
];

function stamp(t) {
  const s = Math.floor(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function LaunchVideo() {
  const videoRef = useRef(null);
  const [started, setStarted] = useState(false);

  function play(at) {
    const v = videoRef.current;
    if (!v) return;
    if (typeof at === "number") v.currentTime = at;
    setStarted(true);
    v.play().catch(() => {});
  }

  return (
    <section id="video" className="launch">
      <div className="wrap">
        <motion.div
          className="launch-head"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.5 }}
        >
          <div className="section-kicker">Launch film · 1:26 · sound on</div>
          <h2>See it in 90 seconds</h2>
          <p className="launch-sub">
            Why your todo list keeps disappearing, and what happens when it can&rsquo;t.
          </p>
        </motion.div>

        <motion.div
          className="launch-frame"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Native controls appear once playback starts; before that the big
              play overlay is the only affordance, so the two never overlap. */}
          <video
            ref={videoRef}
            className="launch-video"
            src={VIDEO_SRC}
            poster={POSTER_SRC}
            controls={started}
            playsInline
            preload="metadata"
            onPlay={() => setStarted(true)}
          >
            Your browser can&rsquo;t play this video.{" "}
            <a href={VIDEO_SRC}>Download the launch film</a> instead.
          </video>
          {!started && (
            <button className="launch-play" onClick={() => play()} aria-label="Play the launch video">
              <span className="launch-play-btn">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
                </svg>
              </span>
              <span className="launch-play-label">Watch the launch film</span>
            </button>
          )}
        </motion.div>

        <div className="launch-chapters" aria-label="Chapters">
          {CHAPTERS.map((c) => (
            <button key={c.label} onClick={() => play(c.t)}>
              <span>{stamp(c.t)}</span> {c.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
