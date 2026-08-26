import { useEffect, useState } from "react";

export default function App() {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = window.fx.onExpandedState(setExpanded);
    window.fx.getExpanded().then(setExpanded);
    return unsubscribe;
  }, []);

  const handleBubbleClick = () => {
    window.fx.toggleExpand(true);
  };

  return (
    <div className="app-root">
      {expanded ? (
        <div className="panel">
          <div className="panel-header">
            <span>Todo</span>
          </div>
          <div className="panel-body panel-placeholder">
            Todo list UI arrives in phase 2.
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="bubble"
          onClick={handleBubbleClick}
          aria-label="Open todo list"
        >
          ✓
        </button>
      )}
    </div>
  );
}
