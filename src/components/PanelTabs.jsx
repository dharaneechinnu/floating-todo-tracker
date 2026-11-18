// Tasks / Vault switch in the panel header. Only shown when the Secret
// vault beta switch is on; otherwise the header keeps its plain title.
export default function PanelTabs({ view, onChange }) {
  return (
    <div className="panel-tabs" role="tablist" aria-label="Panel">
      <button
        type="button"
        role="tab"
        aria-selected={view === "tasks"}
        className={view === "tasks" ? "on" : ""}
        onClick={() => onChange("tasks")}
      >
        Tasks
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "vault"}
        className={view === "vault" ? "on" : ""}
        onClick={() => onChange("vault")}
      >
        🔒 Vault
      </button>
    </div>
  );
}
