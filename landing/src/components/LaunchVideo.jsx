import { useEffect, useRef, useState } from "react";
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
  const [muted, setMuted] = useState(true);

  // Browsers only allow autoplay when the video is muted, so the film starts
  // silent and loops; "Tap for sound" restarts it from the top with audio.
  // Visitors who ask for reduced motion get the poster and must press play.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) v.play().catch(() => {});
  }, []);

  function unmute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.loop = false;
    v.currentTime = 0;
    setMuted(false);
    v.play().catch(() => {});
  }

  function seek(at) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = at;
    v.play().catch(() => {});
  }

  return (
    <section id="film" className="section film">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <span className="kicker">Launch film · 1:24</span>
          <h2>See it in 90 seconds.</h2>
          <p className="section-sub">Why your todo list keeps disappearing, and what happens when it can&rsquo;t.</p>
        </div>

        <div className="film-frame" data-reveal>
          <video
            ref={videoRef}
            className="launch-video"
            src={VIDEO_SRC}
            poster={POSTER_SRC}
            controls
            muted
            loop={muted}
            playsInline
            preload="auto"
            onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
          >
            Your browser can&rsquo;t play this video. <a href={VIDEO_SRC}>Download the launch film</a> instead.
          </video>
          {muted && (
            <button className="launch-unmute" onClick={unmute} aria-label="Play the launch film with sound">
              <Icon name="volume-2" size={20} strokeWidth={2.4} /> Tap for sound
            </button>
          )}
        </div>

        <div className="launch-chapters" aria-label="Chapters">
          {CHAPTERS.map((c) => (
            <button key={c.label} onClick={() => seek(c.t)}>
              <span>{stamp(c.t)}</span> {c.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
