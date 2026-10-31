import { useEffect, useRef } from "react";
import Icon from "./Icon.jsx";
import { prefersReducedMotion } from "../hooks/useReveal.js";

// A looping, code-driven mock desktop: the FocusDock bubble is dragged to the
// right edge, snaps and peeks out with its pending badge, opens into the
// panel, then tucks back. Everything is computed from one clock so it can be
// frozen on a single, meaningful frame for reduced-motion visitors.
const W = 600;
const H = 380;
const B = 64;
const PERIOD = 10;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const p = (t, s, d) => clamp((t - s) / d);
const lerp = (a, b, k) => a + (b - a) * k;
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const spring = (t, s, d = 0.7) => {
  const x = clamp((t - s) / d);
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return 1 - Math.exp(-5.2 * x) * Math.cos(10 * x);
};

export default function HeroVisual() {
  const stageRef = useRef(null);
  const wrapRef = useRef(null);
  const els = useRef({});
  const set = (k) => (el) => {
    els.current[k] = el;
  };

  useEffect(() => {
    const wrap = wrapRef.current;
    const fit = () => {
      if (wrap && stageRef.current) stageRef.current.style.transform = `scale(${wrap.clientWidth / W})`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    const reduced = prefersReducedMotion();
    let raf = 0;
    const start = performance.now();

    function frame(now) {
      const t = reduced ? 3.6 : ((now - start) / 1000) % PERIOD;
      const e = els.current;
      const sx = 200, sy = 170, dx = W - 26, dy = 120, px = W - B * 0.3;
      // drag, snap, peek
      const kd = eio(p(t, 0.9, 1.4));
      let x = lerp(sx, dx, kd);
      let y = lerp(sy, dy, kd);
      const ks = spring(t, 2.35, 0.7);
      if (t > 2.35) x = lerp(dx, px, ks);
      // return to center at the end of the loop
      const kr = eio(p(t, 8.6, 1.0));
      if (t > 8.6) {
        x = lerp(px, sx, kr);
        y = lerp(dy, sy, kr);
      }
      const dragging = t > 0.75 && t < 2.35;
      const squash = t > 2.35 && t < 3.2 ? (1 - spring(t, 2.35, 0.6)) * 0.22 : 0;
      const open = spring(t, 4.6, 0.7) * (1 - eio(p(t, 7.6, 0.45)));
      const bub = e.bubble;
      bub.style.transform = `translate(${x}px, ${y}px) scale(${(dragging ? 1.07 : 1) + squash}, ${(dragging ? 1.07 : 1) - squash})`;
      bub.style.opacity = 1 - clamp(open * 3);
      e.badge.style.transform = `scale(${t > 2.6 && t < 8.6 ? spring(t, 2.6, 0.5) : 0})`;
      e.ghost.style.opacity = t > 2.8 && t < 4.4 ? 0.9 * p(t, 2.8, 0.3) : 0;
      e.glow.style.opacity = t > 2.35 && t < 3.3 ? 1 - p(t, 2.35, 0.95) : 0;
      // cursor
      let cx = x + 40, cy = y + 42;
      if (t < 0.9) {
        const k = eio(p(t, 0.1, 0.75));
        cx = lerp(120, sx + 40, k);
        cy = lerp(320, sy + 42, k);
      } else if (t > 2.35 && t < 4.4) {
        const k = eio(p(t, 2.6, 0.7));
        const k2 = eio(p(t, 3.6, 0.6));
        cx = lerp(lerp(dx + 40, 430, k), px + 10, k2);
        cy = lerp(lerp(dy + 42, 230, k), dy + 30, k2);
      } else if (t >= 4.4) {
        const k = eio(p(t, 5.0, 0.8));
        cx = lerp(px + 10, 360, k);
        cy = lerp(dy + 30, 300, k);
        if (t > 8.4) cx = lerp(360, sx + 40, eio(p(t, 8.4, 1.0)));
        if (t > 8.4) cy = lerp(300, sy + 42, eio(p(t, 8.4, 1.0)));
      }
      e.cursor.style.transform = `translate(${cx}px, ${cy}px)`;
      const click = p(t, 4.35, 0.45);
      e.ripple.style.opacity = click > 0 && click < 1 ? 1 - click : 0;
      e.ripple.style.transform = `translate(${px + 10}px, ${dy + 30}px) scale(${0.3 + click * 1.6})`;
      // panel
      e.panel.style.opacity = clamp(open * 2);
      e.panel.style.transform = `scale(${0.25 + 0.75 * open})`;
      e.chip.style.transform = `scale(${spring(t, 5.4, 0.5)})`;
      e.row3.classList.toggle("is-done", t > 6.3);
      if (!reduced) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="hero-visual" ref={wrapRef} aria-label="Animation: the FocusDock bubble is dragged to the screen edge, docks and peeks out, then opens into a todo list" role="img">
      <div className="hv-stage" ref={stageRef} style={{ width: W, height: H }}>
        <div className="hv-menubar">
          <i style={{ background: "#ff5f57" }} />
          <i style={{ background: "#febc2e" }} />
          <i style={{ background: "#28c840" }} />
          <span>editor — checkout/service.ts</span>
        </div>
        <div className="hv-code">
          {[62, 38, 74, 52, 28, 66, 44, 58, 34, 70, 48].map((w, i) => (
            <div key={i} style={{ width: `${w}%`, marginLeft: `${(i * 7) % 4 * 18}px` }} className={`hv-line c${i % 5}`} />
          ))}
        </div>
        <div className="hv-glow" ref={set("glow")} />
        <div className="hv-ghost" ref={set("ghost")} style={{ left: W - B * 0.3, top: 120, width: B, height: B }} />
        <div className="hv-bubble" ref={set("bubble")} style={{ width: B, height: B }}>
          <Icon name="check" size={28} strokeWidth={3} />
          <span className="hv-badge" ref={set("badge")}>3</span>
        </div>
        <div className="hv-panel" ref={set("panel")}>
          <div className="hv-ph">
            <b>Todo</b>
            <span>3 left</span>
          </div>
          <div className="hv-in">Add or search a todo…</div>
          <div className="hv-row">
            <i />
            Review auth PR <em className="chip p0">P0</em>
            <em className="chip pr" ref={set("chip")}>PR #482</em>
          </div>
          <div className="hv-row blocked">
            <i />
            Orders migration <em className="chip p1">P1</em> 🚫
          </div>
          <div className="hv-row" ref={set("row3")}>
            <i />
            Update API docs <em className="chip due">Today</em>
          </div>
        </div>
        <svg className="hv-cursor" ref={set("cursor")} viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path d="M3 2l7.5 19 2.4-7.6L20.5 11z" fill="#16130f" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        <div className="hv-ripple" ref={set("ripple")} />
      </div>
    </div>
  );
}
