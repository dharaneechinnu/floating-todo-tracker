import { useEffect, useRef, useState, useCallback } from "react";
import TodoPanel from "./components/TodoPanel.jsx";
import VaultPanel from "./components/VaultPanel.jsx";
import PanelTabs from "./components/PanelTabs.jsx";
import { formatBadge, formatClock } from "./utils/focusTimer.js";

// Anything smaller than this, between pointer-down and pointer-up, still
// counts as a click rather than a drag.
const DRAG_THRESHOLD = 4;

export default function App() {
  const [expanded, setExpanded] = useState(false);
  const [todos, setTodos] = useState([]);
  const [focus, setFocus] = useState({ active: false, focusSessionsCompleted: 0 });
  // Which screen edge the bubble is docked to — decides which side of the
  // bubble the badge can sit on and still be on-screen.
  const [dockEdge, setDockEdge] = useState("right");
  const dragRef = useRef(null); // { originX, originY, dragging }
  // Beta switches from the tray; the vault tab only exists when it's on.
  const [features, setFeatures] = useState({});
  const [view, setView] = useState("tasks"); // "tasks" | "vault"
  // How the task list is shown. Kept here, not in the panel, so closing
  // and reopening the panel doesn't reset it.
  const [listView, setListView] = useState({ filter: "all", sort: "manual", doneOpen: true });
  // The "Task deleted · Undo" toast, while it is showing.
  const [undo, setUndo] = useState(null);
  const undoTimer = useRef(null);

  useEffect(() => {
    const unsubExpanded = window.fx.onExpandedState(setExpanded);
    const unsubFocus = window.fx.onFocusState(setFocus);
    // A completed focus session credits a pomodoro to its task in the main
    // process, so the list can change without the renderer asking.
    const unsubTodos = window.fx.onTodosChanged(setTodos);
    const unsubscribeDock = window.fx.onDockEdge((edge) => {
      if (edge) setDockEdge(edge);
    });

    window.fx.getExpanded().then(setExpanded);
    window.fx.getDockEdge().then((edge) => {
      if (edge) setDockEdge(edge);
    });
    window.fx.getTodos().then(setTodos);
    window.fx.getFocus().then(setFocus);
    window.fx.getFeatures().then(setFeatures);
    const unsubFeatures = window.fx.onFeaturesChanged(setFeatures);

    return () => {
      unsubExpanded();
      unsubFocus();
      unsubTodos();
      unsubscribeDock();
      unsubFeatures();
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

  // Every removal offers Undo for 5 seconds. The main process keeps the
  // removed tasks a little longer than that, so a late click still works.
  const offerUndo = useCallback((text) => {
    clearTimeout(undoTimer.current);
    setUndo({ text });
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  }, []);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const handleUndo = useCallback(() => {
    clearTimeout(undoTimer.current);
    setUndo(null);
    window.fx.undoRemove().then(setTodos);
  }, []);

  const handleDelete = useCallback(
    (id) => {
      window.fx.deleteTodo(id).then(setTodos);
      offerUndo("Task deleted");
    },
    [offerUndo]
  );

  const handleViewChange = useCallback((changes) => {
    setListView((current) => ({ ...current, ...changes }));
  }, []);

  const handleEdit = useCallback((id, text) => {
    window.fx.editTodo(id, text).then(setTodos);
  }, []);

  const handlePatch = useCallback((id, patch) => {
    window.fx.patchTodo(id, patch).then(setTodos);
  }, []);

  const handleClearCompleted = useCallback(() => {
    const count = todos.filter((t) => t.done).length;
    window.fx.clearCompleted().then(setTodos);
    offerUndo(`${count} completed ${count === 1 ? "task" : "tasks"} cleared`);
  }, [todos, offerUndo]);

  const handleCompleteSelected = useCallback((ids) => {
    window.fx.completeMany(ids).then(setTodos);
  }, []);

  const handleDeleteSelected = useCallback(
    (ids) => {
      window.fx.deleteMany(ids).then(setTodos);
      offerUndo(`${ids.length} ${ids.length === 1 ? "task" : "tasks"} deleted`);
    },
    [offerUndo]
  );

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

  const handleClose = useCallback(() => {
    window.fx.toggleExpand(false);
  }, []);

  const vaultOn = Boolean(features.vault);
  const activeView = vaultOn ? view : "tasks";
  const tabs = vaultOn ? <PanelTabs view={activeView} onChange={setView} /> : null;

  return (
    <div className="app-root">
      {expanded && activeView === "vault" ? (
        <VaultPanel tabs={tabs} onClose={handleClose} />
      ) : expanded ? (
        <TodoPanel
          tabs={tabs}
          todos={todos}
          focus={focus}
          view={listView}
          onViewChange={handleViewChange}
          undo={undo}
          onUndo={handleUndo}
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
          onClose={handleClose}
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
              ? `Open todo list, ${formatClock(focus.remainingMs)} left in this session`
              : `Open todo list, ${pendingCount} pending`
          }
        >
          ✓
          {badge && (
            <span
              className={`bubble-badge bubble-badge--dock-${dockEdge} bubble-badge--${badge.kind}${
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
