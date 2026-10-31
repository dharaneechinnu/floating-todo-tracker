import Icon from "./Icon.jsx";
import { REPO_URL } from "../hooks/useLatestRelease.js";

const ITEMS = [
  {
    q: "Where is my data stored?",
    a: (
      <>
        In one JSON file on your own machine. On Windows it's <code>%APPDATA%\Floating Todo Tracker\config.json</code>, on
        Linux <code>~/.config/Floating Todo Tracker/config.json</code>. The folder keeps the old name on purpose: FocusDock
        was formerly called Floating Todo Tracker, and keeping the folder means upgrading never loses your list. Nothing
        is synced or uploaded anywhere.
      </>
    ),
  },
  {
    q: "Does it work on Wayland?",
    a: (
      <>
        Mostly. The native Wayland protocol has no "always on top" for regular apps, so in a pure Wayland session the
        bubble can end up behind other windows. That's an Electron/Wayland limitation, not a FocusDock bug. On X11, and
        when it runs through XWayland (the default for most desktops), it stays on top as intended.
      </>
    ),
  },
  {
    q: "Why does Windows show a SmartScreen warning?",
    a: (
      <>
        The installer isn't code-signed yet, so SmartScreen doesn't recognise it on first run. Choose{" "}
        <b>More info → Run anyway</b>. The build comes straight from the public GitHub Actions pipeline, and you can check
        the source yourself.
      </>
    ),
  },
  {
    q: "Is it really free? Is it open source?",
    a: (
      <>
        Yes and yes. FocusDock is MIT-licensed and free, with no paid tier, no account and no ads.{" "}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          The source is on GitHub
        </a>
        .
      </>
    ),
  },
  {
    q: "The AppImage won't start on Linux. What now?",
    a: (
      <>
        AppImages run from a FUSE mount that strips the permission Chromium's sandbox helper needs. Launch it with{" "}
        <code>--no-sandbox</code>, or install the <code>.deb</code> instead.
      </>
    ),
  },
  {
    q: "Is there a macOS version?",
    a: <>Not right now. FocusDock ships for Windows and Linux.</>,
  },
];

export default function FAQ() {
  return (
    <section className="section faq" id="faq">
      <div className="wrap faq-grid">
        <div className="section-head left" data-reveal>
          <span className="kicker">FAQ</span>
          <h2>Good questions.</h2>
          <p className="section-sub">Still curious? Open an issue on GitHub. A real person reads them.</p>
        </div>
        <div className="faq-list" data-reveal>
          {ITEMS.map((it, i) => (
            <details key={it.q} open={i === 0}>
              <summary>
                {it.q}
                <Icon name="chevron-down" size={20} />
              </summary>
              <div className="faq-a">{it.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
