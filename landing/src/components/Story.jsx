import Icon from "./Icon.jsx";
import { DevAtDesk, Bust } from "./Person.jsx";

const WINDOWS = [
  ["message-circle", "Team chat", "#8b5cf6", "w1"],
  ["git-pull-request", "Pull request #482", "#3b82f6", "w2"],
  ["terminal", "Terminal", "#16130f", "w3"],
  ["calendar", "Calendar", "#16a34a", "w4"],
  ["bell", "Inbox (37)", "#eab308", "w5"],
];

function BuriedScene() {
  return (
    <div className="scene scene-buried" aria-hidden="true">
      <div className="todo-tab">
        <Icon name="check" size={14} strokeWidth={3} /> My todo list
      </div>
      <DevAtDesk mood="stress" sweat brows={14} className="buried-dev" />
      {WINDOWS.map(([icon, label, color, cls]) => (
        <div className={`mini-win ${cls}`} key={cls}>
          <div className="mini-tb" style={{ background: color }}>
            <Icon name={icon} size={13} /> {label}
          </div>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function DesktopsScene() {
  return (
    <div className="scene scene-desktops" aria-hidden="true">
      {[3, 2, 1].map((n) => (
        <div className={`desk d${n}`} key={n}>
          <div className="desk-bar">
            <i />
            <i />
            <i />
            <span>Desktop {n}</span>
          </div>
          <div className="desk-lines">
            <span />
            <span />
            <span />
          </div>
          <div className="desk-bubble">
            <Icon name="check" size={18} strokeWidth={3} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PeekScene() {
  return (
    <div className="scene scene-peek" aria-hidden="true">
      <div className="peek-screen">
        <div className="peek-lines">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="peek-bubble">
          <span className="peek-badge">4</span>
        </div>
      </div>
      <div className="peek-hidden" />
      <div className="peek-label l1">
        <b>~30%</b> visible
      </div>
      <div className="peek-label l2">
        <Icon name="lock" size={15} /> stays on your machine
      </div>
    </div>
  );
}

function StandupScene() {
  const tiles = [
    ["dev", "You", "grin"],
    ["priya", "Priya", "grin"],
    ["ana", "Ana", "smile"],
    ["lee", "Lee", "grin"],
  ];
  return (
    <div className="scene scene-standup" aria-hidden="true">
      <div className="call">
        {tiles.map(([who, name, mood], i) => (
          <div className={`tile t${i}`} key={who}>
            <Bust who={who} mood={mood} />
            <span className="tile-name">{name}</span>
            {i > 0 && (
              <span className="react-float" style={{ "--d": `${i * 0.7}s` }}>
                {["👍", "🎉", "🔥"][i - 1]}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="chat-msg">
        <div className="chat-head">
          <b>You</b> <span>#standup · 9:31</span>
        </div>
        <pre>{`📋 Tasks:
⚒️ [P0] Pull Request 482: Review auth refactor
✅ [P2] Update API docs
🚫 Blockers: [P1] Migrate orders table`}</pre>
        <div className="chat-reacts">
          <span>👍 3</span>
          <span>🎉 2</span>
          <span>🔥 1</span>
        </div>
      </div>
    </div>
  );
}

const CHAPTERS = [
  {
    n: "01",
    tag: "The problem",
    title: "Your todo list lives in a tab you forgot.",
    body: "It's behind twelve other windows. Checking it means a context switch, and every switch costs you your flow. Then standup comes round and you're scrambling to remember what you did yesterday.",
    points: [
      ["eye-off", "Out of sight, out of mind"],
      ["app-window", "Alt-Tab just to see what's next"],
      ["clock", "Standup from memory"],
    ],
    scene: <BuriedScene />,
    tone: "red",
  },
  {
    n: "02",
    tag: "What it is",
    title: "A tiny bubble that's always there.",
    body: "FocusDock floats above every window, on every virtual desktop. Click it and your list opens right where it sits. Click ✕ and it shrinks back to a bubble. Nothing to find, nothing to switch to.",
    points: [
      ["layers", "Above every window"],
      ["monitor", "On every desktop"],
      ["mouse-pointer-click", "Opens in place"],
    ],
    scene: <DesktopsScene />,
    tone: "orange",
  },
  {
    n: "03",
    tag: "Why it's different",
    title: "Always in reach. Never in the way.",
    body: "Drag it to any edge and it docks there, peeking out just enough to reach while the rest tucks past the screen edge. It never covers your work. And it's local-first: no account, no server, no telemetry.",
    points: [
      ["move", "Docks to any edge"],
      ["shield-check", "Local-first, private"],
      ["zap", "Instant open and close"],
    ],
    scene: <PeekScene />,
    tone: "blue",
  },
  {
    n: "04",
    tag: "Who it's for",
    title: "Built for engineers tracking real work.",
    body: "Tag tasks with the PR they ship in, flag what's blocked, run focus sessions on the task in front of you, then paste a ready-made standup report while your team reacts.",
    points: [
      ["git-pull-request", "PRs and blockers"],
      ["timer", "Focus sessions 🍅"],
      ["clipboard-check", "One-click report"],
    ],
    scene: <StandupScene />,
    tone: "green",
  },
];

export default function Story() {
  return (
    <section className="section story" id="story">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <span className="kicker">Why FocusDock exists</span>
          <h2>From buried to docked, in four beats.</h2>
        </div>
        <ol className="chapters">
          {CHAPTERS.map((c, i) => (
            <li className={`chapter tone-${c.tone}${i % 2 ? " flip" : ""}`} key={c.n} data-reveal>
              <div className="chapter-copy">
                <div className="chapter-tag">
                  <span className="chapter-n">{c.n}</span>
                  {c.tag}
                </div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
                <ul className="chapter-points">
                  {c.points.map(([icon, label]) => (
                    <li key={label}>
                      <Icon name={icon} size={16} /> {label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="chapter-art">{c.scene}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
