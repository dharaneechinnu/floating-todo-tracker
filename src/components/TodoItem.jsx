import { useEffect, useRef, useState } from "react";

export default function TodoItem({
  todo,
  onToggle,
  onDelete,
  onEdit,
  onPatch,
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
      className={`todo-item${todo.blocked ? " blocked" : todo.done ? " done" : ""}${
        selected ? " selected" : ""
      }`}
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
          <div
            className="todo-edit-group"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) commit();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              className="todo-edit-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.preventDefault()}
            />
            <div className="todo-edit-meta">
              <input
                type="text"
                className="todo-pr-input"
                placeholder="PR #"
                value={todo.prNumber || ""}
                onChange={(e) => onPatch(todo.id, { prNumber: e.target.value })}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.preventDefault()}
              />
              <button
                type="button"
                className={`blocked-toggle${todo.blocked ? " active" : ""}`}
                onClick={() => onPatch(todo.id, { blocked: !todo.blocked })}
              >
                🚫 Blocked
              </button>
            </div>
          </div>
        ) : (
          <span className="todo-text-wrap" onDoubleClick={startEditing}>
            {todo.prNumber ? <span className="pr-badge">PR #{todo.prNumber}</span> : null}
            <span className="todo-text" onClick={(e) => e.preventDefault()}>
              {todo.text}
            </span>
            {todo.blocked ? (
              <span className="blocked-badge" title="Blocked">
                🚫
              </span>
            ) : null}
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
