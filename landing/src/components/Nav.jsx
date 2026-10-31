import { useEffect, useState } from "react";
import BrandMark from "./BrandMark.jsx";
import Icon from "./Icon.jsx";

const LINKS = [
  ["#film", "Film"],
  ["#story", "Story"],
  ["#demo", "Demo"],
  ["#features", "Features"],
  ["#faq", "FAQ"],
];

export default function Nav({ onTakeTour, downloadHref }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className={`nav${scrolled ? " is-scrolled" : ""}${open ? " is-open" : ""}`}>
      <div className="wrap nav-inner">
        <a className="brand" href="#top" onClick={close}>
          <BrandMark size={34} />
          <span>FocusDock</span>
        </a>
        <nav className="nav-links" aria-label="Primary">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
          <button className="btn btn-ghost btn-sm nav-tour" onClick={onTakeTour}>
            Take the tour
          </button>
          <a className="btn btn-primary btn-sm" href={downloadHref}>
            <Icon name="download" size={16} /> Download
          </a>
          <button
            className="nav-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? "x" : "menu"} size={22} />
          </button>
        </div>
      </div>
      <div className="mobile-menu" id="mobile-menu" hidden={!open}>
        <div className="wrap">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} onClick={close}>
              {label}
              <Icon name="arrow-right" size={18} />
            </a>
          ))}
          <button
            className="btn btn-ghost"
            onClick={() => {
              close();
              onTakeTour();
            }}
          >
            Take the guided tour
          </button>
        </div>
      </div>
    </header>
  );
}
