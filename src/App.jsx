import { useEffect, useRef, useState, useCallback } from "react";
import TodoPanel from "./components/TodoPanel.jsx";
import { formatBadge } from "./utils/focusTimer.js";

// Anything smaller than this, between pointer-down and pointer-up, still
// counts as a click rather than a drag.
const DRAG_THRESHOLD = 4;

export default function App() {
  const [expanded, setExpanded] = useState(false);
  const [todos, setTodos] = useState([]);
  const [focus, setFocus] = useState({ active: false, focusSessionsCompleted: 0 });
  const dragRef = useRef(null); // { originX, originY, dragging }

  useEffect(() => {
    const unsubExpanded = window.fx.onExpandedState(setExpanded);
    const unsubFocus = window.fx.onFocusState(setFocus);
    // A completed focus session credits a pomodoro to its task in the main
    // process, so the list can change without the renderer asking.
    const unsubTodos = window.fx.onTodosChanged(setTodos);

    window.fx.getExpanded().then(setExpanded);
    window.fx.getTodos().then(setTodos);
    window.fx.getFocus().then(setFocus);

    return () => {
      unsubExpanded();
      unsubFocus();
      unsubTodos();
    };
  }, []);

  const handleBubblePointerDown = (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { originX: e.screenX, originY: e.screenY, dragging: false };
    window.fx.dragBubbleStart(e.screenX, e.screenY);
  };

  const handleBubblePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.screenX - drag.originX;
    const dy = e.screenY - drag.originY;
    if (!drag.dragging && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
      drag.dragging = true;
    }
    if (drag.dragging) {
      window.fx.dragBubbleMove(e.screenX, e.screenY);
    }
  };

  const handleBubblePointerUp = (e) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (drag.dragging) {
      window.fx.dragBubbleEnd();
    } else {
      window.fx.toggleExpand(true);
    }
  };

  const handleAdd = useCallback((text) => {
    window.fx.addTodo(text).then(setTodos);
  }, []);

  const handleToggle = useCallback((id) => {
    window.fx.toggleTodo(id).then(setTodos);
  }, []);

  const handleDelete = useCallback((id) => {
    window.fx.deleteTodo(id).then(setTodos);
  }, []);

  const handleEdit = useCallback((id, text) => {
    window.fx.editTodo(id, text).then(setTodos);
  }, []);

  const handlePatch = useCallback((id, patch) => {
    window.fx.patchTodo(id, patch).then(setTodos);
  }, []);

  const handleClearCompleted = useCallback(() => {
    window.fx.clearCompleted().then(setTodos);
  }, []);

  const handleCompleteSelected = useCallback((ids) => {
    window.fx.completeMany(ids).then(setTodos);
  }, []);

  const handleDeleteSelected = useCallback((ids) => {
    window.fx.deleteMany(ids).then(setTodos);
  }, []);

  const handleReorder = useCallback((orderedIds) => {
    setTodos((current) => {
      const byId = new Map(current.map((t) => [t.id, t]));
      return orderedIds.map((id) => byId.get(id)).filter(Boolean);
    });
    window.fx.reorderTodos(orderedIds);
  }, []);

  const handleStartFocus = useCallback((phase, taskId) => {
    window.fx.startFocus(phase, taskId).then(setFocus);
  }, []);

  const handlePauseFocus = useCallback(() => {
    window.fx.pauseFocus().then(setFocus);
  }, []);

  const handleResumeFocus = useCallback(() => {
    window.fx.resumeFocus().then(setFocus);
  }, []);

  const handleStopFocus = useCallback(() => {
    window.fx.stopFocus().then(setFocus);
  }, []);

  const pendingCount = todos.filter((t) => !t.done).length;

  /*
   * The badge is the only part of the bubble guaranteed to stay on-screen
   * once it docks and peeks, so a live session takes it over — a running
   * clock is the more urgent of the two numbers, and the pending count is
   * one click away. Minutes only: "24:07" doesn't fit a ~22px sliver.
   */
  const badge = focus.active
    ? { text: formatBadge(focus.remainingMs), kind: focus.phase }
    : pendingCount > 0
      ? { text: pendingCount > 99 ? "99+" : String(pendingCount), kind: "count" }
      : null;

  return (
    <div className="app-root">
      {expanded ? (
        <TodoPanel
          todos={todos}
          focus={focus}
          onAdd={handleAdd}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onPatch={handlePatch}
          onClearCompleted={handleClearCompleted}
          onCompleteSelected={handleCompleteSelected}
          onDeleteSelected={handleDeleteSelected}
          onReorder={handleReorder}
          onStartFocus={handleStartFocus}
          onPauseFocus={handlePauseFocus}
          onResumeFocus={handleResumeFocus}
          onStopFocus={handleStopFocus}
        />
      ) : (
        <button
          type="button"
          className="bubble"
          onPointerDown={handleBubblePointerDown}
          onPointerMove={handleBubblePointerMove}
          onPointerUp={handleBubblePointerUp}
          aria-label={
            focus.active
              ? `Open todo list, ${formatBadge(focus.remainingMs)} left in this session`
              : `Open todo list, ${pendingCount} pending`
          }
        >
          ✓
          {badge && (
            <span
              className={`bubble-badge bubble-badge--${badge.kind}${
                focus.active && focus.running ? " running" : ""
              }`}
            >
              {badge.text}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
