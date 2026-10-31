import AppDemo from "./AppDemo.jsx";
import Icon from "./Icon.jsx";

export default function DemoSection({ refs, activeStepId, onTakeTour }) {
  return (
    <section className="section demo" id="demo">
      <div className="wrap demo-grid">
        <div className="demo-copy" data-reveal>
          <span className="kicker">Try it right here</span>
          <h2>Go on, poke it. It's live.</h2>
          <p>
            This is a working mock of the panel. Type to search your list, and press Enter to add a todo when nothing
            matches. Tick things off and drag rows around, just like the real app.
          </p>
          <ul className="demo-tips">
            <li>
              <Icon name="search" size={18} /> Type <kbd>auth</kbd> to filter
            </li>
            <li>
              <Icon name="keyboard" size={18} /> Type something new, then press <kbd>Enter</kbd>
            </li>
            <li>
              <Icon name="grip-vertical" size={18} /> Drag a row to reorder
            </li>
          </ul>
          <button className="btn btn-dark" onClick={onTakeTour}>
            <Icon name="sparkles" size={18} /> Take the guided tour
          </button>
        </div>
        <div className="demo-art" data-reveal>
          <AppDemo refs={refs} activeStepId={activeStepId} />
        </div>
      </div>
    </section>
  );
}
