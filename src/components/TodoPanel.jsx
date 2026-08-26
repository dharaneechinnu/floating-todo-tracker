import { useMemo, useRef, useState } from "react";
import TodoItem from "./TodoItem.jsx";
import { buildSessionReport } from "../utils/logoutReport.js";

export default function TodoPanel({
  todos,
  onAdd,
  onToggle,
  onDelete,
  onEdit,
  onPatch,
  onClearCompleted,
  onCompleteSelected,
  onDeleteSelected,
  onReorder,
}) {
  const [draft, setDraft] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [sessionMode, setSessionMode] = useState(null); // null | "login" | "logout"
  const [collaborations, setCollaborations] = useState("");
  const [blockerNote, setBlockerNote] = useState("");
  const [todayPlan, setTodayPlan] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const dragIndex = useRef(null);

  const query = draft.trim().toLowerCase();
  const searching = query.length > 0;

  const visibleTodos = useMemo(() => {
    if (!searching) return todos;
    return todos.filter((t) => t.text.toLowerCase().includes(query));
  }, [todos, searching, query]);

  const exactMatchExists = useMemo(() => {
    if (!searching) return false;
    return todos.some((t) => t.text.trim().toLowerCase() === query);
  }, [todos, searching, query]);

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
  const completedCount = todos.length - remaining;

  const allVisibleSelected = visibleTodos.length > 0 && selectedIds.size === visibleTodos.length;

  const exitSelecting = () => {
    setSelecting(false);
    setSelectedIds(new Set());
  };

  // First click enters selection mode with everything selected; while
  // already selecting, it's a select-all/deselect-all toggle instead of
  // exiting — exiting is an explicit "Done".
  const handleSelectAllClick = () => {
    if (!selecting) {
      setSelecting(true);
      setSelectedIds(new Set(visibleTodos.map((t) => t.id)));
    } else if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleTodos.map((t) => t.id)));
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

  const sessionReport = useMemo(
    () => buildSessionReport(todos, { mode: sessionMode || "logout", collaborations, blockerNote, todayPlan }),
    [todos, sessionMode, collaborations, blockerNote, todayPlan]
  );

  const openSession = (mode) => {
    setSessionMode(mode);
    setCopied(false);
    setCopyFailed(false);
  };

  const closeSession = () => {
    setSessionMode(null);
    setCollaborations("");
    setBlockerNote("");
    setTodayPlan("");
    setCopied(false);
    setCopyFailed(false);
  };

  const handleCopyReport = async () => {
    try {
      await window.fx.copyToClipboard(sessionReport);
      setCopied(true);
      setCopyFailed(false);
    } catch (err) {
      console.error("Copy to clipboard failed:", err);
      setCopied(false);
      setCopyFailed(true);
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Todo</span>
        <div className="panel-header-right">
          <span className="panel-count">{remaining} left</span>
          {!sessionMode && !selecting && (
            <>
              <button
                type="button"
                className="logout-trigger"
                onClick={() => openSession("login")}
                title="Generate login report"
              >
                🔑 Login
              </button>
              <button
                type="button"
                className="logout-trigger"
                onClick={() => openSession("logout")}
                title="Generate logout report"
              >
                🕘 Logout
              </button>
            </>
          )}
        </div>
      </div>

      {sessionMode ? (
        <div className="logout-view">
          <textarea
            className="logout-preview"
            value={sessionReport}
            readOnly
            spellCheck={false}
          />
          <div className="logout-fields">
            <label>
              Collaborations (one per line)
              <textarea
                rows={2}
                value={collaborations}
                onChange={(e) => {
                  setCollaborations(e.target.value);
                  setCopied(false);
                  setCopyFailed(false);
                }}
                placeholder="Discussed PR review with…"
              />
            </label>
            <label>
              Additional blockers (one per line)
              <textarea
                rows={2}
                value={blockerNote}
                onChange={(e) => {
                  setBlockerNote(e.target.value);
                  setCopied(false);
                  setCopyFailed(false);
                }}
                placeholder="Waiting on staging access…"
              />
            </label>
            {sessionMode === "login" && (
              <label>
                Task for today (one per line)
                <textarea
                  rows={2}
                  value={todayPlan}
                  onChange={(e) => {
                    setTodayPlan(e.target.value);
                    setCopied(false);
                    setCopyFailed(false);
                  }}
                  placeholder="Ship PR #12897…"
                />
              </label>
            )}
          </div>
          <div className="logout-actions">
            <button type="button" className="plain" onClick={closeSession}>
              Close
            </button>
            <button type="button" className={copyFailed ? "danger" : ""} onClick={handleCopyReport}>
              {copyFailed ? "Copy failed — retry" : copied ? "Copied ✓" : "Copy to Clipboard"}
            </button>
          </div>
        </div>
      ) : selecting ? (
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
            type="text"
            placeholder="Add or search…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
        </form>
      )}

      {!sessionMode && (
        <div className="panel-body">
          {todos.length === 0 ? (
            <div className="panel-placeholder">Nothing here yet.</div>
          ) : searching && visibleTodos.length === 0 ? (
            <div className="panel-placeholder">
              No matches — press Enter to add &ldquo;{draft.trim()}&rdquo;.
            </div>
          ) : (
            <ul className="todo-list">
              {visibleTodos.map((todo, index) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onPatch={onPatch}
                  draggable={!searching && !selecting}
                  selecting={selecting}
                  selected={selectedIds.has(todo.id)}
                  onToggleSelect={handleToggleSelect}
                  dragHandlers={
                    searching || selecting
                      ? {}
                      : {
                          onDragStart: handleDragStart(index),
                          onDragOver: handleDragOver(index),
                          onDragEnd: handleDragEnd,
                        }
                  }
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {!sessionMode && !selecting && completedCount > 0 && (
        <div className="panel-footer">
          <button type="button" className="clear-completed" onClick={onClearCompleted}>
            Clear completed ({completedCount})
          </button>
        </div>
      )}
    </div>
  );
}
