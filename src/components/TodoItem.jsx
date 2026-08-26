import { useEffect, useRef, useState } from "react";

export default function TodoItem({
  todo,
  onToggle,
  onDelete,
  onEdit,
  dragHandlers,
  draggable = true,
  selecting = false,
  selected = false,
  onToggleSelect,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = () => {
    if (selecting) return;
    setDraft(todo.text);
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== todo.text) onEdit(todo.id, trimmed);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(todo.text);
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  return (
    <li
      className={`todo-item${todo.done ? " done" : ""}${selected ? " selected" : ""}`}
      draggable={draggable && !editing}
      {...dragHandlers}
    >
      {selecting && (
        <input
          type="checkbox"
          className="todo-select"
          checked={selected}
          onChange={() => onToggleSelect(todo.id)}
          aria-label={`Select "${todo.text}"`}
        />
      )}
      <label className="todo-check">
        <input
          type="checkbox"
          checked={todo.done}
          onChange={() => onToggle(todo.id)}
        />
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            className="todo-edit-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.preventDefault()}
          />
        ) : (
          <span
            className="todo-text"
            onClick={(e) => e.preventDefault()}
            onDoubleClick={startEditing}
          >
            {todo.text}
          </span>
        )}
      </label>
      <button
        type="button"
        className="todo-delete"
        aria-label={`Delete "${todo.text}"`}
        onClick={() => onDelete(todo.id)}
      >
        ×
      </button>
    </li>
  );
}
