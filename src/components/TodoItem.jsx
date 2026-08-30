import { useEffect, useRef, useState } from "react";
import { PRIORITIES, dueLabel, dueStatus, isValidDueDate } from "../utils/taskMeta.js";

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
  onStartFocus,
  focusActiveOnTask = false,
  focusBusy = false,
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

  const due = dueStatus(todo);

  return (
    <li
      className={`todo-item${todo.blocked ? " blocked" : todo.done ? " done" : ""}${
        selected ? " selected" : ""
      }${due === "overdue" ? " overdue" : ""}`}
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
            <div className="todo-edit-meta">
              <div className="priority-picker" role="group" aria-label="Priority">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`priority-pick priority-pick--${p.id}${
                      todo.priority === p.id ? " active" : ""
                    }`}
                    title={p.title}
                    aria-pressed={todo.priority === p.id}
                    // Clicking the active one clears it — no separate
                    // "none" button to spend width on.
                    onClick={() =>
                      onPatch(todo.id, {
                        priority: todo.priority === p.id ? "" : p.id,
                      })
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="date"
                className="todo-due-input"
                aria-label="Due date"
                value={todo.dueDate || ""}
                onChange={(e) => {
                  const next = e.target.value;
                  // A date input can hand back a partial value mid-typing;
                  // only persist something the sorters can actually read.
                  if (isValidDueDate(next)) onPatch(todo.id, { dueDate: next });
                }}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.preventDefault()}
              />
            </div>
          </div>
        ) : (
          <span className="todo-text-wrap" onDoubleClick={startEditing}>
            {todo.priority ? (
              <span className={`priority-badge priority-badge--${todo.priority}`}>
                {todo.priority.toUpperCase()}
              </span>
            ) : null}
            {todo.prNumber ? <span className="pr-badge">PR #{todo.prNumber}</span> : null}
            <span className="todo-text" onClick={(e) => e.preventDefault()}>
              {todo.text}
            </span>
            {todo.pomodoros > 0 ? (
              <span
                className="pomodoro-badge"
                title={`${todo.pomodoros} focus session${todo.pomodoros === 1 ? "" : "s"} on this task`}
              >
                🍅{todo.pomodoros > 1 ? `×${todo.pomodoros}` : ""}
              </span>
            ) : null}
            {due ? (
              <span
                className={`due-badge due-badge--${due}`}
                title={`Due ${todo.dueDate}`}
              >
                {dueLabel(todo.dueDate)}
              </span>
            ) : null}
            {todo.blocked ? (
              <span className="blocked-badge" title="Blocked">
                🚫
              </span>
            ) : null}
          </span>
        )}
      </label>
      {!selecting && !editing && !todo.done && onStartFocus ? (
        <button
          type="button"
          className={`focus-start${focusActiveOnTask ? " active" : ""}`}
          // One session at a time — starting a second would make "which task
          // does this pomodoro belong to" ambiguous.
          disabled={focusBusy}
          title={
            focusActiveOnTask
              ? "This task's session is running"
              : focusBusy
                ? "Finish or stop the current session first"
                : "Start a 25-minute focus session"
          }
          aria-label={`Start a focus session on "${todo.text}"`}
          onClick={() => onStartFocus("focus", todo.id)}
        >
          ▶
        </button>
      ) : null}
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
