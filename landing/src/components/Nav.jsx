import { useEffect, useRef, useState } from "react";
import BrandMark from "./BrandMark.jsx";
import Icon from "./Icon.jsx";

// The site's navigation is a macOS-style dock pinned to the bottom of the
// page, a nod to the product itself (a bubble docked at the screen edge).
// Hovering magnifies the item under the pointer and its neighbours, the
// way the Mac Dock does; clicking makes the item bounce like a launching
// app. A small dot marks the section currently in view.
const ITEMS = [
  { id: "top", href: "#top", label: "FocusDock", brand: true },
  { id: "film", href: "#film", label: "Launch film", icon: "circle-play", tone: "orange" },
  { id: "story", href: "#story", label: "Story", icon: "sparkles", tone: "purple" },
  { id: "demo", href: "#demo", label: "Try the demo", icon: "mouse-pointer-click", tone: "blue" },
  { id: "features", href: "#features", label: "Features", icon: "layers", tone: "green" },
  { id: "faq", href: "#faq", label: "FAQ", icon: "message-circle", tone: "yellow" },
];

const MAX_SCALE = 1.7; // size of the item directly under the pointer
const REACH = 130; // px either side of the pointer that still magnifies

function canMagnify() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return (
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function Nav({ onTakeTour, downloadHref }) {
  const dockRef = useRef(null);
  const [active, setActive] = useState("top");
  const [bouncing, setBouncing] = useState(null);

  // Highlight whichever section is in view.
  useEffect(() => {
    const ids = ITEMS.map((i) => i.id).filter((id) => id !== "top");
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length || !("IntersectionObserver" in window)) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.25, 0.5] },
    );
    els.forEach((el) => io.observe(el));
    const onScroll = () => window.scrollY < 200 && setActive("top");
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  function magnify(e) {
    if (!canMagnify()) return;
    const items = dockRef.current?.querySelectorAll(".dock-item");
    items?.forEach((el) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(e.clientX - (r.left + r.width / 2));
      const t = Math.max(0, 1 - d / REACH);
      // Cosine falloff gives the soft "wave" of the real Dock.
      const s = 1 + (MAX_SCALE - 1) * (0.5 - 0.5 * Math.cos(Math.PI * t));
      el.style.setProperty("--s", s.toFixed(3));
    });
  }

  function reset() {
    dockRef.current?.querySelectorAll(".dock-item").forEach((el) => el.style.setProperty("--s", "1"));
  }

  function bounce(id) {
    setBouncing(id);
    window.setTimeout(() => setBouncing((b) => (b === id ? null : b)), 900);
  }

  const itemClass = (id, extra = "") =>
    `dock-item${active === id ? " is-active" : ""}${bouncing === id ? " is-bouncing" : ""}${extra}`;

  return (
    <nav className="dock" aria-label="Primary" ref={dockRef} onMouseMove={magnify} onMouseLeave={reset}>
      {ITEMS.map((item) => (
        <a
          key={item.id}
          href={item.href}
          className={itemClass(item.id)}
          aria-label={item.label}
          aria-current={active === item.id ? "true" : undefined}
          onClick={() => bounce(item.id)}
        >
          <span className="dock-tip" aria-hidden="true">
            {item.label}
          </span>
          <span className={`dock-tile${item.brand ? " dock-tile--brand" : ` dock-tile--${item.tone}`}`}>
            {item.brand ? <BrandMark size={48} /> : <Icon name={item.icon} size={22} strokeWidth={2.2} />}
          </span>
          <span className="dock-dot" aria-hidden="true" />
        </a>
      ))}

      <span className="dock-sep" aria-hidden="true" />

      <button
        type="button"
        className={itemClass("tour", " dock-item--tour")}
        aria-label="Take the guided tour"
        onClick={() => {
          bounce("tour");
          onTakeTour();
        }}
      >
        <span className="dock-tip" aria-hidden="true">
          Guided tour
        </span>
        <span className="dock-tile dock-tile--ink">
          <Icon name="zap" size={22} strokeWidth={2.2} />
        </span>
        <span className="dock-dot" aria-hidden="true" />
      </button>

      <a href={downloadHref} className={itemClass("download")} aria-label="Download FocusDock" onClick={() => bounce("download")}>
        <span className="dock-tip" aria-hidden="true">
          Download
        </span>
        <span className="dock-tile dock-tile--download">
          <Icon name="download" size={22} strokeWidth={2.4} />
        </span>
        <span className="dock-dot" aria-hidden="true" />
      </a>
    </nav>
  );
}
