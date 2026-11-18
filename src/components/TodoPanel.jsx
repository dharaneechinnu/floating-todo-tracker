import { useEffect, useMemo, useRef, useState } from "react";
import TodoItem from "./TodoItem.jsx";
import {
  SESSIONS_BEFORE_LONG_BREAK,
  formatClock,
  sessionLabel,
} from "../utils/focusTimer.js";
import { FILTERS, SORTS, filterTodos, searchTodos, sortTodos } from "../utils/taskMeta.js";

const EMPTY_FILTER_TEXT = {
  open: "Nothing open. Everything is done.",
  late: "Nothing is late.",
  top: "No open P0 or P1 tasks.",
};

export default function TodoPanel({
  todos,
  focus,
  view,
  onViewChange,
  undo,
  onUndo,
  onAdd,
  onToggle,
  onDelete,
  onEdit,
  onPatch,
  onClearCompleted,
  onCompleteSelected,
  onDeleteSelected,
  onReorder,
  onStartFocus,
  onPauseFocus,
  onResumeFocus,
  onStopFocus,
  onClose,
  tabs,
}) {
  const [draft, setDraft] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const dragId = useRef(null);
  const inputRef = useRef(null);

  const { filter, sort, doneOpen } = view;
  const query = draft.trim().toLowerCase();
  const searching = query.length > 0;

  // Search looks through every task, whatever filter is on: a filter that
  // hid the match would make "Already in your list" impossible to act on.
  const listed = useMemo(() => {
    const base = searching ? searchTodos(todos, query) : filterTodos(todos, filter);
    return sortTodos(base, sort);
  }, [todos, searching, query, filter, sort]);

  // Finished tasks gather in a "Done" group under the open ones.
  const openRows = useMemo(() => listed.filter((t) => !t.done), [listed]);
  const doneRows = useMemo(() => listed.filter((t) => t.done), [listed]);
  const shownTodos = useMemo(
    () => (doneOpen || searching ? [...openRows, ...doneRows] : openRows),
    [openRows, doneRows, doneOpen, searching]
  );

  const exactMatchExists = useMemo(() => {
    if (!searching) return false;
    return todos.some((t) => t.text.trim().toLowerCase() === query);
  }, [todos, searching, query]);

  // Drag-to-reorder writes a real position into the stored list, so it
  // only works while the screen shows that stored order.
  const triaging = filter !== "all" || sort !== "manual";
  const canDrag = !searching && !selecting && !triaging;

  const submit = (e) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    // Already in the list — this submit just leaves the search filtered
    // down to the match instead of creating a near-duplicate.
    if (exactMatchExists) return;
    onAdd(trimmed);
    setDraft("");
  };

  const exitSelecting = () => {
    setSelecting(false);
    setSelectedIds(new Set());
  };

  /*
   * Esc steps back one level at a time: out of selection mode, then clears
   * the search, then closes the panel. A row being renamed handles its own
   * Esc (it cancels the rename) and marks the event as handled.
   */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      if (selecting) exitSelecting();
      else if (draft) setDraft("");
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting, draft, onClose]);

  // Id-based, because with the Done group the screen order is not the
  // stored order. A task only moves among tasks in the same group.
  const handleDragStart = (id) => () => {
    dragId.current = id;
  };

  const handleDragOver = (targetId) => (e) => {
    e.preventDefault();
    const fromId = dragId.current;
    if (fromId === null || fromId === targetId) return;
    const from = todos.findIndex((t) => t.id === fromId);
    const to = todos.findIndex((t) => t.id === targetId);
    if (from === -1 || to === -1 || todos[from].done !== todos[to].done) return;
    const next = [...todos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next.map((t) => t.id));
  };

  const handleDragEnd = () => {
    dragId.current = null;
  };

  const remaining = todos.filter((t) => !t.done).length;
  const completedCount = todos.length - remaining;

  const allVisibleSelected = shownTodos.length > 0 && shownTodos.every((t) => selectedIds.has(t.id));

  // First click enters selection mode with everything selected; while
  // already selecting, it's a select-all/deselect-all toggle instead of
  // exiting — exiting is an explicit "Done".
  const handleSelectAllClick = () => {
    if (!selecting) {
      setSelecting(true);
      setSelectedIds(new Set(shownTodos.map((t) => t.id)));
    } else if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(shownTodos.map((t) => t.id)));
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCompleteSelected = () => {
    if (selectedIds.size === 0) return;
    onCompleteSelected(Array.from(selectedIds));
    exitSelecting();
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    onDeleteSelected(Array.from(selectedIds));
    exitSelecting();
  };

  // One line under the box that says what Enter is about to do.
  let hint = null;
  if (searching) {
    if (exactMatchExists) hint = <>Already in your list</>;
    else if (listed.length) {
      hint = (
        <>
          {listed.length} {listed.length === 1 ? "match" : "matches"} · <kbd>Enter</kbd> adds “{draft.trim()}”
        </>
      );
    } else hint = <><kbd>Enter</kbd> adds “{draft.trim()}”</>;
  }

  const renderRow = (todo) => (
    <TodoItem
      key={todo.id}
      todo={todo}
      onToggle={onToggle}
      onDelete={onDelete}
      onEdit={onEdit}
      onPatch={onPatch}
      onStartFocus={onStartFocus}
      focusActiveOnTask={!!focus && focus.active && focus.taskId === todo.id}
      focusBusy={!!focus && focus.active}
      draggable={canDrag}
      selecting={selecting}
      selected={selectedIds.has(todo.id)}
      onToggleSelect={handleToggleSelect}
      dragHandlers={
        canDrag
          ? {
              onDragStart: handleDragStart(todo.id),
              onDragOver: handleDragOver(todo.id),
              onDragEnd: handleDragEnd,
            }
          : {}
      }
    />
  );

  let body;
  if (todos.length === 0) {
    body = (
      <div className="panel-empty">
        <b>Your list is empty</b>
        <span>Type a task above and press <kbd>Enter</kbd>.</span>
        <span>Use ✎ on a task to set its priority, due date or PR number.</span>
      </div>
    );
  } else if (searching && listed.length === 0) {
    body = (
      <div className="panel-placeholder">
        No matches. Press <kbd>Enter</kbd> to add &ldquo;{draft.trim()}&rdquo;.
      </div>
    );
  } else if (listed.length === 0) {
    body = (
      <div className="panel-placeholder">
        {EMPTY_FILTER_TEXT[filter] || "Nothing to show."}{" "}
        <button type="button" className="link-button" onClick={() => onViewChange({ filter: "all" })}>
          Show all
        </button>
      </div>
    );
  } else {
    body = (
      <>
        {openRows.length > 0 && <ul className="todo-list">{openRows.map(renderRow)}</ul>}
        {doneRows.length > 0 && (
          <>
            <button
              type="button"
              className="done-group"
              aria-expanded={doneOpen || searching}
              onClick={() => onViewChange({ doneOpen: !doneOpen })}
              disabled={searching}
            >
              <span className="done-group-caret" aria-hidden="true">{doneOpen || searching ? "▾" : "▸"}</span>
              Done ({doneRows.length})
            </button>
            {(doneOpen || searching) && <ul className="todo-list">{doneRows.map(renderRow)}</ul>}
          </>
        )}
      </>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        {tabs || <span>Todo</span>}
        <div className="panel-header-right">
          <span className="panel-count">{remaining} left</span>
          <button
            type="button"
            className="panel-close"
            onClick={onClose}
            aria-label="Close todo list"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>
      </div>

      {selecting ? (
        <div className="bulk-bar">
          <button
            type="button"
            className={`toggle-all${allVisibleSelected ? " active" : ""}`}
            onClick={handleSelectAllClick}
            aria-label={allVisibleSelected ? "Deselect all" : "Select all"}
            title={allVisibleSelected ? "Deselect all" : "Select all"}
          >
            ✓
          </button>
          <span className="bulk-count">{selectedIds.size} selected</span>
          <div className="bulk-actions">
            <button type="button" onClick={handleCompleteSelected} disabled={selectedIds.size === 0}>
              Complete
            </button>
            <button
              type="button"
              className="danger"
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0}
            >
              Delete
            </button>
            <button type="button" className="plain" onClick={exitSelecting}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form className="todo-add" onSubmit={submit}>
          <div className="todo-add-row">
            {todos.length > 0 && (
              <button
                type="button"
                className="toggle-all"
                onClick={handleSelectAllClick}
                aria-label="Select todos"
                title="Select todos"
              >
                ✓
              </button>
            )}
            <input
              ref={inputRef}
              id="todo-add-input"
              type="text"
              placeholder="Add or search…"
              aria-label="Add a task or search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
          </div>
          {hint && <p className="todo-hint" role="status">{hint}</p>}
        </form>
      )}

      {todos.length > 0 && !selecting && (
        <div className={`list-tools${searching ? " muted" : ""}`}>
          <div className="filter-chips" role="group" aria-label="Show">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`chip${filter === f.id ? " on" : ""}`}
                aria-pressed={filter === f.id}
                title={searching ? "Search looks through every task" : f.title}
                onClick={() => onViewChange({ filter: f.id })}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="sort-pick">
            <span className="sr-only">Sort by</span>
            <select id="todo-sort" value={sort} onChange={(e) => onViewChange({ sort: e.target.value })}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {focus && focus.active && (
        <div className={`focus-bar focus-bar--${focus.phase}`}>
          <span className="focus-phase">{sessionLabel(focus)}</span>
          <span className="focus-clock">{formatClock(focus.remainingMs)}</span>
          <div className="focus-actions">
            {focus.running ? (
              <button type="button" onClick={onPauseFocus} title="Pause">
                Pause
              </button>
            ) : (
              <button type="button" onClick={onResumeFocus} title="Start this session">
                Start
              </button>
            )}
            <button type="button" className="plain" onClick={onStopFocus} title="End session">
              ✕
            </button>
          </div>
        </div>
      )}

      {focus && focus.active && focus.focusSessionsCompleted > 0 && (
        <div className="focus-streak" aria-label={`${focus.focusSessionsCompleted} focus sessions done`}>
          {/* Where you are in the run of four before the long break. */}
          {Array.from({ length: SESSIONS_BEFORE_LONG_BREAK }).map((_, i) => (
            <span
              key={i}
              className={`streak-dot${
                i < focus.focusSessionsCompleted % SESSIONS_BEFORE_LONG_BREAK ||
                (focus.focusSessionsCompleted > 0 &&
                  focus.focusSessionsCompleted % SESSIONS_BEFORE_LONG_BREAK === 0)
                  ? " filled"
                  : ""
              }`}
            />
          ))}
          <span className="streak-label">{focus.focusSessionsCompleted} done today</span>
        </div>
      )}

      <div className="panel-body">{body}</div>

      {!selecting && completedCount > 0 && (
        <div className="panel-footer">
          <button type="button" className="clear-completed" onClick={onClearCompleted}>
            Clear completed ({completedCount})
          </button>
        </div>
      )}

      {undo && (
        <div className="undo-toast" role="status">
          <span>{undo.text}</span>
          <button type="button" onClick={onUndo}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
