import { motion } from "framer-motion";
import { detectOS } from "../hooks/useOS.js";
import { useLatestRelease, RELEASES_URL, ALL_RELEASES_URL, REPO_URL } from "../hooks/useLatestRelease.js";

const META = {
  win: { label: "Windows", fmt: ".exe installer (NSIS)", glyph: "🪟" },
  mac: { label: "macOS", fmt: ".dmg disk image", glyph: "🍎" },
  linux: { label: "Linux", fmt: ".AppImage / .deb", glyph: "🐧" },
};

export default function Platforms() {
  const { status, release, assets } = useLatestRelease();
  const os = detectOS();

  const primaryAsset = assets[os];
  const primaryHref = primaryAsset ? primaryAsset.browser_download_url : RELEASES_URL;

  return (
    <section id="download">
      <div className="wrap">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.5 }}
        >
          Get it for your platform
        </motion.h2>

        <div className="downloads-lead">
          <a className="btn-primary big" href={primaryHref}>
            <span>{META[os].glyph}</span> Download for {META[os].label}
            {release?.tag_name && <span className="ver">{release.tag_name}</span>}
          </a>
          <div className="fetch-note">
            {status === "loading" && "Looking up the latest release…"}
            {status === "ready" && (
              <>
                Latest release:{" "}
                <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
                  {release.tag_name}
                </a>
              </>
            )}
            {status === "empty" && (
              <>
                No published release yet —{" "}
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                  check the repo
                </a>
                .
              </>
            )}
          </div>
        </div>

        <motion.div
          className="platforms"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
        >
          {Object.keys(META).map((key) => {
            const asset = assets[key];
            const href = asset ? asset.browser_download_url : RELEASES_URL;
            const label = status === "loading" ? "Fetching…" : asset ? "Download" : "See releases";
            return (
              <div className="platform-card" key={key}>
                <div className="glyph">{META[key].glyph}</div>
                <h4>{META[key].label}</h4>
                <div className="fmt">{META[key].fmt}</div>
                <a
                  href={href}
                  className={status === "loading" ? "disabled" : ""}
                  target={asset ? undefined : "_blank"}
                  rel={asset ? undefined : "noopener noreferrer"}
                >
                  {label}
                </a>
              </div>
            );
          })}
        </motion.div>

        <div className="all-releases">
          <a href={ALL_RELEASES_URL} target="_blank" rel="noopener noreferrer">
            See all releases →
          </a>
        </div>
      </div>
    </section>
  );
}
