import BrandMark from "./BrandMark.jsx";
import { REPO_URL, ALL_RELEASES_URL } from "../hooks/useLatestRelease.js";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div className="footer-brand">
          <a className="brand" href="#top">
            <BrandMark size={30} />
            <span>FocusDock</span>
          </a>
          <p>Your todo list, docked. Free, open source and local-first.</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <a href="#film">Launch film</a>
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            Source on GitHub
          </a>
          <a href={ALL_RELEASES_URL} target="_blank" rel="noopener noreferrer">
            All releases
          </a>
        </nav>
      </div>
      <div className="wrap footer-fine">
        <span>© 2026 FocusDock contributors · MIT licence</span>
        <span>Made for people who live in their editor.</span>
      </div>
    </footer>
  );
}
