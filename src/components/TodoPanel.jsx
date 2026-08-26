import { useRef, useState } from "react";
import TodoItem from "./TodoItem.jsx";

export default function TodoPanel({ todos, onAdd, onToggle, onDelete, onReorder }) {
  const [draft, setDraft] = useState("");
  const dragIndex = useRef(null);

  const submit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft("");
  };

  const handleDragStart = (index) => () => {
    dragIndex.current = index;
  };

  const handleDragOver = (index) => (e) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === index) return;
    const next = [...todos];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(index, 0, moved);
    dragIndex.current = index;
    onReorder(next.map((t) => t.id));
  };

  const handleDragEnd = () => {
    dragIndex.current = null;
  };

  const remaining = todos.filter((t) => !t.done).length;

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Todo</span>
        <span className="panel-count">{remaining} left</span>
      </div>

      <form className="todo-add" onSubmit={submit}>
        <input
          type="text"
          placeholder="Add a todo…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
      </form>

      <div className="panel-body">
        {todos.length === 0 ? (
          <div className="panel-placeholder">Nothing here yet.</div>
        ) : (
          <ul className="todo-list">
            {todos.map((todo, index) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={onToggle}
                onDelete={onDelete}
                dragHandlers={{
                  onDragStart: handleDragStart(index),
                  onDragOver: handleDragOver(index),
                  onDragEnd: handleDragEnd,
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
