import { useRef, useState } from "react";
import Icon from "./Icon.jsx";

const BASE = import.meta.env.BASE_URL;
const VIDEO_SRC = `${BASE}launch-video.mp4`;
const POSTER_SRC = `${BASE}launch-poster.jpg`;

// Chapter start times match the narration segments the film was cut to
// (see landing/video/README.md). Update both together if it's re-cut.
const CHAPTERS = [
  { t: 0, label: "The problem" },
  { t: 15.5, label: "Meet FocusDock" },
  { t: 23.3, label: "Why it's different" },
  { t: 37.7, label: "Who it's for" },
  { t: 44.6, label: "Walkthrough" },
  { t: 75.3, label: "Get it" },
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
    <section id="film" className="section film">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <span className="kicker">Launch film · 1:24 · sound on</span>
          <h2>See it in 90 seconds.</h2>
          <p className="section-sub">Why your todo list keeps disappearing, and what happens when it can&rsquo;t.</p>
        </div>

        <div className="film-frame" data-reveal>
          {/* Native controls appear once playback starts; before that the
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
            Your browser can&rsquo;t play this video. <a href={VIDEO_SRC}>Download the launch film</a> instead.
          </video>
          {!started && (
            <button className="launch-play" onClick={() => play()} aria-label="Play the launch video">
              <span className="launch-play-btn">
                <Icon name="play" size={34} strokeWidth={2.5} />
              </span>
              <span className="launch-play-label">Watch the launch film</span>
            </button>
          )}
        </div>

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
