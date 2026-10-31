import { useEffect, useState } from "react";
import { ICON_DATA_URI } from "../icon-data.js";

export default function Navbar({ onTakeTour }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={scrolled ? "scrolled" : ""}>
      <div className="wrap navbar-inner">
        <a className="brand" href="#top">
          <img src={ICON_DATA_URI} alt="" />
          Floating Todo Tracker
        </a>
        <div className="nav-links">
          <a href="#video">Video</a>
          <a href="#story" className="hide-mobile">Why</a>
          <a href="#features" className="hide-mobile">Features</a>
          <a href="#compare" className="hide-mobile">Compare</a>
          <button className="nav-tour" onClick={onTakeTour}>
            Take the tour
          </button>
          <a href="#download" className="nav-download">
            Download
          </a>
        </div>
      </div>
    </nav>
  );
}
