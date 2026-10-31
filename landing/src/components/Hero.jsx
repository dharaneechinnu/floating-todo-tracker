import Icon from "./Icon.jsx";
import HeroVisual from "./HeroVisual.jsx";

const OS_LABEL = { win: "Windows", linux: "Linux" };

export default function Hero({ os, primaryHref, version, onTakeTour }) {
  return (
    <section className="hero" id="top">
      <div className="hero-bg" aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <a className="eyebrow" href="#film">
            <span className="eyebrow-dot" /> New: meet FocusDock in 90 seconds <Icon name="arrow-right" size={15} />
          </a>
          <h1 className="hero-title">
            <span className="w" style={{ "--i": 0 }}>Your</span> <span className="w" style={{ "--i": 1 }}>todo</span>{" "}
            <span className="w" style={{ "--i": 2 }}>list,</span>
            <br />
            <span className="w docked" style={{ "--i": 3 }}>
              docked.
              <svg className="squiggle" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true">
                <path d="M4 16 C 60 4, 110 22, 160 12 S 260 6, 296 14" pathLength="1" />
              </svg>
            </span>
          </h1>
          <p className="hero-sub">
            FocusDock is a tiny bubble that sits on the edge of your screen, above every window and every desktop. One
            click opens your list. PRs, blockers and focus sessions live there, and your standup report is one click
            away.
          </p>
          <div className="hero-ctas">
            <a className="btn btn-primary btn-lg" href={primaryHref}>
              <Icon name="download" size={20} /> Download for {OS_LABEL[os]}
              {version && <span className="btn-meta">{version}</span>}
            </a>
          </div>
          <ul className="hero-trust">
            <li>
              <Icon name="lock" size={16} /> 100% local
            </li>
            <li>
              <Icon name="user-x" size={16} /> No account
            </li>
            <li>
              <Icon name="heart" size={16} /> Free &amp; open source
            </li>
          </ul>
          <button className="text-link" onClick={onTakeTour}>
            Or take the interactive tour <Icon name="arrow-right" size={15} />
          </button>
        </div>
        <div className="hero-art">
          <HeroVisual />
          <div className="float-card fc1">
            <Icon name="git-pull-request" size={18} /> PR #482 · ready for review
          </div>
          <div className="float-card fc2">
            <span className="tomato">🍅</span> 3 focus sessions today
          </div>
        </div>
      </div>
    </section>
  );
}
