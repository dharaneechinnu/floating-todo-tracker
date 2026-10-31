import Icon from "./Icon.jsx";
import { RELEASES_URL, ALL_RELEASES_URL, REPO_URL } from "../hooks/useLatestRelease.js";

export const OS_META = {
  win: { label: "Windows", fmt: "Installer (.exe, NSIS)", icon: "monitor", note: "Windows 10 and 11, 64-bit" },
  linux: { label: "Linux", fmt: "AppImage or .deb", icon: "terminal", note: "X11 or XWayland sessions" },
};

export default function Platforms({ os, release }) {
  const { status, release: rel, assets } = release;
  const primary = assets[os];
  const loading = status === "loading";

  const cards = [
    { key: "win", links: [[assets.win, ".exe installer"]] },
    { key: "linux", links: [[assets.linux, "AppImage"], [assets.deb, ".deb package"]] },
  ];

  return (
    <section className="section download" id="download">
      <div className="wrap">
        <div className="download-card" data-reveal>
          <div className="download-copy">
            <span className="kicker">Download</span>
            <h2>Get FocusDock. It's free.</h2>
            <p className="section-sub">
              {status === "ready" && rel?.tag_name ? (
                <>
                  Latest release{" "}
                  <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
                    {rel.tag_name}
                  </a>
                  . No account, no sign-up, no card.
                </>
              ) : status === "empty" ? (
                <>
                  No published release found right now.{" "}
                  <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                    Check the repo
                  </a>
                  .
                </>
              ) : (
                "Looking up the latest release…"
              )}
            </p>
            <a className={`btn btn-primary btn-lg${loading ? " is-loading" : ""}`} href={primary ? primary.browser_download_url : RELEASES_URL}>
              <Icon name="download" size={20} /> Download for {OS_META[os].label}
              {rel?.tag_name && <span className="btn-meta">{rel.tag_name}</span>}
            </a>
          </div>
          <div className="platform-cards">
            {cards.map(({ key, links }) => (
              <div className={`platform${key === os ? " is-you" : ""}`} key={key}>
                <span className="platform-icon">
                  <Icon name={OS_META[key].icon} size={26} />
                </span>
                <div className="platform-meta">
                  <h3>
                    {OS_META[key].label}
                    {key === os && <span className="you">Your OS</span>}
                  </h3>
                  <span>{OS_META[key].fmt}</span>
                  <small>{OS_META[key].note}</small>
                </div>
                <div className="platform-links">
                  {links.map(([asset, label]) => (
                    <a
                      key={label}
                      href={asset ? asset.browser_download_url : RELEASES_URL}
                      className={loading ? "is-loading" : ""}
                      target={asset ? undefined : "_blank"}
                      rel={asset ? undefined : "noopener noreferrer"}
                    >
                      {loading ? "Fetching…" : asset ? label : `${label} (releases)`}
                      <Icon name="arrow-right" size={15} />
                    </a>
                  ))}
                </div>
              </div>
            ))}
            <a className="all-releases" href={ALL_RELEASES_URL} target="_blank" rel="noopener noreferrer">
              All releases and checksums <Icon name="arrow-right" size={15} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
