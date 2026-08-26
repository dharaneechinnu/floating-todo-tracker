import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export const TOUR_STEPS = [
  {
    id: "bubble",
    target: "bubble",
    title: "Meet the bubble",
    body: "It docks to a screen edge and floats on top of every window, on every virtual desktop — always one glance away.",
  },
  {
    id: "expand",
    target: "bubble",
    title: "One click to open",
    body: "Click it and it expands into a full todo list, right where it's sitting. Watch it happen.",
  },
  {
    id: "add",
    target: "input",
    title: "Add a todo",
    body: "Type and hit enter. No modal, no context switch — you're never more than a click from capturing a thought.",
  },
  {
    id: "check",
    target: "todo",
    title: "Check things off",
    body: "One click marks a todo done. Simple, fast, satisfying.",
  },
  {
    id: "drag",
    target: "todo",
    title: "Drag to reorder",
    body: "Priorities change — drag any todo up or down to reorder the list, right on the panel.",
  },
  {
    id: "tray",
    target: "tray",
    title: "Tray icon as a safety net",
    body: "Drag the bubble off-screen or just want it hidden? The tray icon shows/hides it, toggles launch-at-login, or quits.",
  },
  {
    id: "local",
    target: null,
    title: "100% local, always",
    body: "No account, no server, no telemetry. Every todo lives only on your machine.",
  },
];

function useRect(el, active) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!active || !el) {
      setRect(null);
      return undefined;
    }

    function update() {
      setRect(el.getBoundingClientRect());
    }

    update();
    const id = setInterval(update, 120);
    window.addEventListener("resize", update);
    return () => {
      clearInterval(id);
      window.removeEventListener("resize", update);
    };
  }, [el, active]);

  return rect;
}

export default function ProductTour({ refs, active, stepIndex, onNext, onPrev, onSkip, onFinish }) {
  const step = TOUR_STEPS[stepIndex];
  const targetEl = step?.target ? refs.current[step.target] : null;
  const rect = useRect(targetEl, active);
  const tipRef = useRef(null);
  const [pos, setPos] = useState(null);

  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const pad = 10;

  // Measure the tooltip's real size each step and place it with plain
  // top/left (never CSS `transform`) — framer-motion owns `transform` for
  // its own enter/exit animation, and the two would otherwise fight.
  useLayoutEffect(() => {
    if (!active || !tipRef.current) return;
    const tw = tipRef.current.offsetWidth;
    const th = tipRef.current.offsetHeight;
    const margin = 16;

    let left, top;
    if (rect) {
      const centerX = rect.left + rect.width / 2;
      left = Math.min(Math.max(centerX - tw / 2, margin), window.innerWidth - tw - margin);
      const below = rect.bottom + th + 34 < window.innerHeight;
      top = below ? rect.bottom + pad + 14 : Math.max(margin, rect.top - th - pad - 14);
    } else {
      left = (window.innerWidth - tw) / 2;
      top = (window.innerHeight - th) / 2;
    }
    setPos({ left, top });
  }, [active, rect, stepIndex]);

  if (!active || !step) return null;

  const spotlightStyle = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        borderRadius: rect.width < 90 ? 999 : 16,
      }
    : {
        top: "50%",
        left: "50%",
        width: 0,
        height: 0,
        borderRadius: 999,
      };

  return (
    <div className="tour-root">
      <div className="tour-scrim" onClick={onSkip} />
      <motion.div
        className="tour-spotlight"
        animate={spotlightStyle}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          ref={tipRef}
          className="tour-tooltip"
          style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: pos ? 1 : 0, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          <div className="tour-step-count">
            Step {stepIndex + 1} of {TOUR_STEPS.length}
          </div>
          <h4>{step.title}</h4>
          <p>{step.body}</p>
          <div className="tour-dots">
            {TOUR_STEPS.map((s, i) => (
              <span key={s.id} className={i === stepIndex ? "on" : ""} />
            ))}
          </div>
          <div className="tour-actions">
            <button className="tour-skip" onClick={onSkip}>
              Skip
            </button>
            <div className="tour-actions-right">
              {stepIndex > 0 && (
                <button className="tour-btn ghost" onClick={onPrev}>
                  Back
                </button>
              )}
              <button className="tour-btn" onClick={isLast ? onFinish : onNext}>
                {isLast ? "Get started" : "Next"}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
