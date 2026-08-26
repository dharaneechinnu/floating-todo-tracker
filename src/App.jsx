import { useEffect, useRef, useState, useCallback } from "react";
import TodoPanel from "./components/TodoPanel.jsx";

// Anything smaller than this, between pointer-down and pointer-up, still
// counts as a click rather than a drag.
const DRAG_THRESHOLD = 4;

export default function App() {
  const [expanded, setExpanded] = useState(false);
  const [todos, setTodos] = useState([]);
  const dragRef = useRef(null); // { originX, originY, dragging }

  useEffect(() => {
    const unsubscribe = window.fx.onExpandedState(setExpanded);
    window.fx.getExpanded().then(setExpanded);
    window.fx.getTodos().then(setTodos);
    return unsubscribe;
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

  return (
    <div className="app-root">
      {expanded ? (
        <TodoPanel
          todos={todos}
          onAdd={handleAdd}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onPatch={handlePatch}
          onClearCompleted={handleClearCompleted}
          onCompleteSelected={handleCompleteSelected}
          onDeleteSelected={handleDeleteSelected}
          onReorder={handleReorder}
        />
      ) : (
        <button
          type="button"
          className="bubble"
          onPointerDown={handleBubblePointerDown}
          onPointerMove={handleBubblePointerMove}
          onPointerUp={handleBubblePointerUp}
          aria-label="Open todo list"
        >
          ✓
        </button>
      )}
    </div>
  );
}
