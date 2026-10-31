import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";

const BASE = import.meta.env.BASE_URL;
const VIDEO_SRC = `${BASE}launch-video.mp4`;
const POSTER_SRC = `${BASE}launch-poster.jpg`;

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

  // No native controls are shown, so clicking the film pauses/resumes it.
  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }

  return (
    <section id="film" className="section film">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <span className="kicker">Introducing</span>
          <h2>Meet FocusDock.</h2>
          <p className="section-sub">The todo list that stays on your screen, docked at the edge, ready when you are.</p>
        </div>

        <div className="film-frame" data-reveal>
          <video
            ref={videoRef}
            className="launch-video"
            src={VIDEO_SRC}
            poster={POSTER_SRC}
            muted
            loop={muted}
            playsInline
            preload="auto"
            onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
            onClick={togglePlay}
          >
            Your browser can&rsquo;t play this video. <a href={VIDEO_SRC}>Download the launch film</a> instead.
          </video>
          {muted && (
            <button className="launch-unmute" onClick={unmute} aria-label="Play the launch film with sound">
              <Icon name="volume-2" size={20} strokeWidth={2.4} /> Tap for sound
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
