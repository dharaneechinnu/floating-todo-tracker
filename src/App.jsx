import { useEffect, useState, useCallback } from "react";
import TodoPanel from "./components/TodoPanel.jsx";

export default function App() {
  const [expanded, setExpanded] = useState(false);
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    const unsubscribe = window.fx.onExpandedState(setExpanded);
    window.fx.getExpanded().then(setExpanded);
    window.fx.getTodos().then(setTodos);
    return unsubscribe;
  }, []);

  const handleBubbleClick = () => {
    window.fx.toggleExpand(true);
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
          onReorder={handleReorder}
        />
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
