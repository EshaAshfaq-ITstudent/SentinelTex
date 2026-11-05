// Line icons drawn inline (no download needed: the app is offline).
// <Glyph> puts an icon on a small chamfered plate; tone "lit" | "pass" | "fail" | "check" makes it glow.
const PATHS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  review: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  image: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5a1.5 1.5 0 1 0 0-.01',
  test: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7 15h10',
  trend: 'M4 19h16M5 15l4-5 4 3 6-7M15 6h4v4',
  chat: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  samples: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  inbox: 'M4 13l3-8h10l3 8v6H4zM4 13h5l1 2h4l1-2h5',
  stamp: 'M9 4h6l-1 7h4v4H6v-4h4zM5 20h14',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  gauge: 'M4 16a8 8 0 1 1 16 0M12 16l4-5M3 20h18',
  cpu: 'M7 7h10v10H7zM10 10h4v4h-4zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  database: 'M5 6c0-1.7 3-3 7-3s7 1.3 7 3-3 3-7 3-7-1.3-7-3zM5 6v12c0 1.7 3 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3 3 7 3s7-1.3 7-3',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  check: 'M5 12l5 5 9-10',
  alert: 'M12 4l9 16H3zM12 10v4M12 17v.01',
  x: 'M6 6l12 12M18 6L6 18',
  scan: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M4 12h16',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6',
  plus: 'M12 5v14M5 12h14',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  play: 'M7 4l13 8-13 8z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  lock: 'M6 11h12v10H6zM9 11V8a3 3 0 0 1 6 0v3',
}
export default function Icon({ name, size = 18, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }} aria-hidden="true">
      <path d={PATHS[name] || PATHS.spark} />
    </svg>
  )
}

export function Glyph({ name, tone = '', size = 18 }) {
  return <span className={`glyph ${tone}`}><Icon name={name} size={size} /></span>
}

// The SentinelTex emblem: a shield with an inspection reticle. Stroke only, so it can be drawn in on the splash.
export function Emblem({ size = 34 }) {
  return (
    <svg className="emblem" width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="#d6b25e" strokeWidth="2.4"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M24 4l16 6v12c0 10-7 17-16 21C15 39 8 32 8 22V10z" />
      <circle className="late" cx="24" cy="23" r="7" />
      <line className="late" x1="24" y1="11" x2="24" y2="16" />
      <line className="late" x1="24" y1="30" x2="24" y2="35" />
      <line className="late" x1="12" y1="23" x2="17" y2="23" />
      <line className="late" x1="31" y1="23" x2="36" y2="23" />
    </svg>
  )
}
