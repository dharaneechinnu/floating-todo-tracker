// Flat illustrated characters from the FocusDock launch film, ported to React.
// They are drawn for the film and are not real people.
const MOUTH = {
  smile: "M106 118 Q120 130 134 118",
  grin: "M104 114 Q120 136 136 114 Z",
  stress: "M106 123 Q113 116 120 123 Q127 130 134 123",
  flat: "M109 121 L131 121",
  o: "M114 120 Q120 112 126 120 Q120 128 114 120 Z",
};

export const PEOPLE = {
  dev: { skin: "#c68642", shade: "#a86f35", hair: "#2b1a10", shirt: "#3b82f6", style: "short", glasses: true },
  priya: { skin: "#8d5524", shade: "#74441b", hair: "#1a1a1a", shirt: "#22c55e", style: "curly" },
  ana: { skin: "#f1c27d", shade: "#d9a865", hair: "#7c3f12", shirt: "#a855f7", style: "long" },
  lee: { skin: "#ffdbac", shade: "#e8bf8e", hair: "#d4a24c", shirt: "#ef4444", style: "bun" },
};

function Hair({ style, color }) {
  if (style === "curly")
    return [[86, 78, 14], [98, 62, 15], [116, 55, 16], [134, 58, 15], [150, 70, 14], [158, 86, 11], [82, 92, 10]].map(([cx, cy, r]) => (
      <circle key={cx + "-" + cy} cx={cx} cy={cy} r={r} fill={color} />
    ));
  if (style === "bun")
    return (
      <>
        <circle cx="120" cy="42" r="15" fill={color} />
        <path d="M80 96 C76 58 104 48 124 50 C152 52 166 68 160 98 C150 76 134 68 118 70 C100 72 88 82 80 96Z" fill={color} />
      </>
    );
  if (style === "long")
    return <path d="M80 96 C76 58 104 44 124 46 C152 48 166 66 160 98 C152 80 134 66 112 70 C96 74 86 84 80 96Z" fill={color} />;
  return <path d="M80 96 C76 58 104 44 124 46 C152 48 166 66 160 98 C152 78 136 70 118 72 C100 74 88 82 80 96Z" fill={color} />;
}

export function Figure({ who = "dev", mood = "smile", sweat = false, brows = 0 }) {
  const p = PEOPLE[who];
  const filled = mood === "grin" || mood === "o";
  return (
    <g className="person">
      <path d="M44 260 C44 182 78 160 120 160 C162 160 196 182 196 260 Z" fill={p.shirt} />
      <path d="M100 162 Q120 182 140 162" fill="none" stroke="rgba(0,0,0,.12)" strokeWidth="5" strokeLinecap="round" />
      <rect x="107" y="130" width="26" height="36" rx="10" fill={p.shade} />
      <g className="person-head">
        {p.style === "long" && (
          <path d="M80 90 C70 130 72 168 96 178 L102 112 Z M160 90 C170 130 168 168 144 178 L138 112 Z" fill={p.hair} />
        )}
        <circle cx="82" cy="102" r="9" fill={p.shade} />
        <circle cx="158" cy="102" r="9" fill={p.shade} />
        <ellipse cx="120" cy="98" rx="38" ry="42" fill={p.skin} />
        <Hair style={p.style} color={p.hair} />
        <g fill="#2a1d14">
          <rect x="94" y="80" width="17" height="4" rx="2" transform={`rotate(${brows} 102 82)`} />
          <rect x="129" y="80" width="17" height="4" rx="2" transform={`rotate(${-brows} 138 82)`} />
        </g>
        <g className="person-eyes" fill="#1f2937">
          <ellipse cx="103" cy="97" rx="4.2" ry="5.2" />
          <ellipse cx="137" cy="97" rx="4.2" ry="5.2" />
        </g>
        {p.glasses && (
          <g fill="none" stroke="#1f2937" strokeWidth="2.6">
            <rect x="92" y="88" width="22" height="17" rx="6" />
            <rect x="126" y="88" width="22" height="17" rx="6" />
            <path d="M114 96 L126 96" />
          </g>
        )}
        <circle cx="96" cy="113" r="6" fill="#f472b6" opacity=".22" />
        <circle cx="144" cy="113" r="6" fill="#f472b6" opacity=".22" />
        <path d={MOUTH[mood]} stroke="#7c2d12" strokeWidth="3.6" fill={filled ? "#7c2d12" : "none"} strokeLinecap="round" strokeLinejoin="round" />
        {sweat && <path className="person-sweat" d="M162 64 q7 11 0 16 q-7 -5 0 -16z" fill="#60a5fa" />}
      </g>
    </g>
  );
}

// A developer sitting behind a laptop whose lid faces the viewer.
export function DevAtDesk({ mood = "smile", sweat = false, brows = 0, className = "" }) {
  const p = PEOPLE.dev;
  return (
    <svg className={`dev-desk ${className}`} viewBox="0 0 240 300" role="img" aria-label="Illustrated developer at a laptop">
      <Figure who="dev" mood={mood} sweat={sweat} brows={brows} />
      <ellipse className="hand hand-l" cx="66" cy="222" rx="15" ry="11" fill={p.skin} />
      <ellipse className="hand hand-r" cx="174" cy="222" rx="15" ry="11" fill={p.skin} />
      <rect x="52" y="186" width="136" height="88" rx="10" fill="#d9dde5" stroke="#c4cad6" strokeWidth="2" />
      <circle cx="120" cy="230" r="11" fill="#ff7a1a" />
      <rect x="20" y="272" width="200" height="12" rx="6" fill="#e3c9a8" />
    </svg>
  );
}

// Head-and-shoulders crop for avatars and video-call tiles.
export function Bust({ who, mood = "smile", className = "" }) {
  return (
    <svg className={`bust ${className}`} viewBox="20 20 200 240" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <Figure who={who} mood={mood} />
    </svg>
  );
}
