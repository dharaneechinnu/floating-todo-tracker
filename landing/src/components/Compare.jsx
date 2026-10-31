import Icon from "./Icon.jsx";

const ROWS = [
  ["Where it lives", "On the edge of your screen, above every window", "In a browser tab or behind the app switcher"],
  ["Getting started", "Open it. That's it.", "Sign up, verify your email, pick a plan"],
  ["Your data", "A file on your machine that never leaves it", "Uploaded to someone else's server"],
  ["Capturing a thought", "Click, type, Enter, and you're back to work", "Switch apps, wait, find the input, type"],
  ["Standup", "A formatted report, one click away", "Reconstructed from memory"],
  ["Cost", "Free and open source", "Free tier, real features behind a paywall"],
];

export default function Compare() {
  return (
    <section className="section compare" id="compare">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <span className="kicker">Compare</span>
          <h2>Not another todo app in a tab.</h2>
          <p className="section-sub">Most task managers wait for you to open them. FocusDock is already there.</p>
        </div>
        <div className="compare-grid" data-reveal>
          <div className="compare-col us">
            <div className="compare-head">
              <span className="compare-badge">FocusDock</span>
            </div>
            {ROWS.map(([label, us]) => (
              <div className="compare-row" key={label}>
                <span className="compare-label">{label}</span>
                <span className="compare-val">
                  <Icon name="check" size={18} strokeWidth={3} /> {us}
                </span>
              </div>
            ))}
          </div>
          <div className="compare-col them">
            <div className="compare-head">
              <span className="compare-badge muted">Typical todo apps</span>
            </div>
            {ROWS.map(([label, , them]) => (
              <div className="compare-row" key={label}>
                <span className="compare-label">{label}</span>
                <span className="compare-val">
                  <Icon name="x" size={18} strokeWidth={3} /> {them}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
