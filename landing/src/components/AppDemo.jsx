import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SEED_TODOS = [
  { id: 1, text: "Write release notes", done: false },
  { id: 2, text: "Set up electron-builder", done: true },
];

const TYPED_TEXT = "Ship the landing page";

export default function AppDemo({ refs, activeStepId, onStepReady }) {
  const [expanded, setExpanded] = useState(false);
  const [todos, setTodos] = useState(SEED_TODOS);
  const [draft, setDraft] = useState("");
  const [dragIndex, setDragIndex] = useState(null);
  const [pulseTray, setPulseTray] = useState(false);
  const nextId = useRef(3);
  const typingTimer = useRef(null);

  const setRef = (key) => (el) => {
    if (refs) refs.current[key] = el;
  };

  function addTodo(text) {
    const clean = text.trim();
    if (!clean) return;
    setTodos((t) => [...t, { id: nextId.current++, text: clean, done: false }]);
    setDraft("");
  }

  function toggle(id) {
    setTodos((t) => t.map((td) => (td.id === id ? { ...td, done: !td.done } : td)));
  }

  function remove(id) {
    setTodos((t) => t.filter((td) => td.id !== id));
  }

  function handleDrop(index) {
    if (dragIndex === null || dragIndex === index) return;
    setTodos((t) => {
      const copy = [...t];
      const [moved] = copy.splice(dragIndex, 1);
      copy.splice(index, 0, moved);
      return copy;
    });
    setDragIndex(null);
  }

  // Drives the demo automatically while a guided-tour step is active.
  useEffect(() => {
    clearInterval(typingTimer.current);

    if (!activeStepId) return undefined;

    if (activeStepId === "bubble") {
      setExpanded(false);
    }

    if (activeStepId === "expand") {
      const t = setTimeout(() => setExpanded(true), 450);
      return () => clearTimeout(t);
    }

    if (activeStepId === "add") {
      setExpanded(true);
      let i = 0;
      setDraft("");
      typingTimer.current = setInterval(() => {
        i += 1;
        setDraft(TYPED_TEXT.slice(0, i));
        if (i >= TYPED_TEXT.length) {
          clearInterval(typingTimer.current);
          setTimeout(() => {
            addTodo(TYPED_TEXT);
            onStepReady?.();
          }, 400);
        }
      }, 45);
      return () => clearInterval(typingTimer.current);
    }

    if (activeStepId === "check") {
      setExpanded(true);
      const t = setTimeout(() => {
        setTodos((prev) =>
          prev.map((td, idx) => (idx === prev.length - 1 ? { ...td, done: true } : td))
        );
      }, 350);
      return () => clearTimeout(t);
    }

    if (activeStepId === "drag") {
      setExpanded(true);
    }

    if (activeStepId === "tray") {
      setExpanded(false);
      setPulseTray(true);
      const t = setTimeout(() => setPulseTray(false), 1400);
      return () => clearTimeout(t);
    }

    return undefined;
  }, [activeStepId]);

  const remaining = todos.filter((t) => !t.done).length;

  return (
    <div className="demo-stage">
      <div className="demo-menubar">
        <div className="demo-menubar-dots">
          <span />
          <span />
          <span />
        </div>
        <div
          ref={setRef("tray")}
          className={"demo-tray" + (pulseTray ? " pulse" : "")}
          title="System tray"
        >
          ✓
        </div>
      </div>

      <div className="demo-canvas">
        <div className={"demo-bubble-wrap" + (expanded ? " still" : "")}>
          <motion.div
            ref={setRef("bubble")}
            className="demo-bubble"
            role="button"
            tabIndex={0}
            onClick={() => setExpanded((e) => !e)}
            onKeyDown={(e) => e.key === "Enter" && setExpanded((v) => !v)}
            animate={expanded ? { scale: 0.001, opacity: 0 } : { scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            aria-label="Open todo list"
          >
            ✓
          </motion.div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              className="demo-panel"
              initial={{ scale: 0.3, opacity: 0, x: 40, y: 40 }}
              animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
              exit={{ scale: 0.3, opacity: 0, x: 40, y: 40 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
            >
              <div className="demo-panel-head">
                <span>Todo</span>
                <div className="demo-panel-head-right">
                  <span className="demo-count">{remaining} left</span>
                  <button
                    className="demo-close"
                    onClick={() => setExpanded(false)}
                    aria-label="Collapse"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="demo-add" ref={setRef("input")}>
                <input
                  value={draft}
                  placeholder="Add a todo…"
                  readOnly={activeStepId === "add"}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTodo(draft)}
                />
              </div>

              <ul className="demo-list">
                {todos.map((todo, idx) => (
                  <li
                    key={todo.id}
                    ref={idx === 0 ? setRef("todo") : undefined}
                    className={"demo-item" + (todo.done ? " done" : "")}
                    draggable
                    onDragStart={() => setDragIndex(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(idx)}
                  >
                    <label className="demo-check">
                      <input
                        type="checkbox"
                        checked={todo.done}
                        onChange={() => toggle(todo.id)}
                      />
                      <span>{todo.text}</span>
                    </label>
                    <button className="demo-del" onClick={() => remove(todo.id)} aria-label="Delete">
                      ×
                    </button>
                  </li>
                ))}
                {todos.length === 0 && <li className="demo-empty">Nothing here yet — add one above.</li>}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="demo-hint">This is a live mock — click the bubble, add a todo, try dragging.</p>
    </div>
  );
}
