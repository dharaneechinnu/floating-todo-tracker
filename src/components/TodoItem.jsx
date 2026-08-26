export default function TodoItem({ todo, onToggle, onDelete, dragHandlers }) {
  return (
    <li
      className={`todo-item${todo.done ? " done" : ""}`}
      draggable
      {...dragHandlers}
    >
      <label className="todo-check">
        <input
          type="checkbox"
          checked={todo.done}
          onChange={() => onToggle(todo.id)}
        />
        <span className="todo-text">{todo.text}</span>
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
