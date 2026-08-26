import { REPO_URL, ALL_RELEASES_URL } from "../hooks/useLatestRelease.js";

export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        Free and open source ·{" "}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          Source on GitHub
        </a>{" "}
        ·{" "}
        <a href={ALL_RELEASES_URL} target="_blank" rel="noopener noreferrer">
          All releases
        </a>
      </div>
    </footer>
  );
}
