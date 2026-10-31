import Icon from "./Icon.jsx";

export default function Privacy() {
  return (
    <section className="privacy" id="privacy">
      <div className="wrap privacy-inner" data-reveal>
        <div className="privacy-copy">
          <span className="privacy-lock">
            <Icon name="folder-lock" size={30} />
          </span>
          <h2>Your todos never leave your machine.</h2>
          <p>
            FocusDock has no backend to send anything to. Everything lives in one small JSON file in your user-data
            folder, and the app never phones home.
          </p>
        </div>
        <div className="privacy-stats">
          <div>
            <b>0</b>
            <span>accounts</span>
          </div>
          <div>
            <b>0</b>
            <span>servers</span>
          </div>
          <div>
            <b>0</b>
            <span>telemetry</span>
          </div>
        </div>
      </div>
    </section>
  );
}
