import { useMemo, useRef, useState } from "react";
import TodoItem from "./TodoItem.jsx";

export default function TodoPanel({
  todos,
  onAdd,
  onToggle,
  onDelete,
  onEdit,
  onClearCompleted,
  onCompleteSelected,
  onDeleteSelected,
  onReorder,
}) {
  const [draft, setDraft] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
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

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Todo</span>
        <span className="panel-count">{remaining} left</span>
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

      {!selecting && completedCount > 0 && (
        <div className="panel-footer">
          <button type="button" className="clear-completed" onClick={onClearCompleted}>
            Clear completed ({completedCount})
          </button>
        </div>
      )}
    </div>
  );
}
