import { useId } from 'react';

/**
 * Entry art drawn in code (SVG, no images, no AI): the mission patch, the crew marks and the day stars.
 * Palette (one warm family on night blue, harmonious with the game's orange "go"):
 *   night #070b1d · #0e1533 · #16204a — cream #fff3dd — gold #ffc56b / #f2a53a / #c97a1e — cyan #5ee0ff (Earth only).
 * The patch is our own emblem: no agency logo, insignia or flag (team hard limit).
 */

/** A four-point star (the seven days; the last, home, is the big gold one). */
export function Star({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path d="M12 0 L14.6 9.4 L24 12 L14.6 14.6 L12 24 L9.4 14.6 L0 12 L9.4 9.4 Z" fill="currentColor" />
    </svg>
  );
}

/**
 * The mission patch: a gold-stitched ring, night sky, a crescent Moon over the base's horizon with the habitat
 * dome lit, the small Earth, and seven stars in an arc — six white days and the gold one: home.
 */
export function MissionPatch({ size = 112 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  const rim = `rim${id}`;
  const sky = `sky${id}`;
  const moon = `moon${id}`;
  const cut = `cut${id}`;
  const ground = `ground${id}`;
  // seven stars on an arc over the moon
  const stars = Array.from({ length: 7 }, (_, i) => {
    const a = ((-150 + i * 20) * Math.PI) / 180;
    return { x: 60 + Math.cos(a) * 38, y: 62 + Math.sin(a) * 38, big: i === 6 };
  });
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className="patch" aria-hidden="true">
      <defs>
        <linearGradient id={rim} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe2a8" />
          <stop offset="0.5" stopColor="#f2a53a" />
          <stop offset="1" stopColor="#b8681a" />
        </linearGradient>
        <radialGradient id={sky} cx="0.5" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#1f2c63" />
          <stop offset="0.65" stopColor="#0e1533" />
          <stop offset="1" stopColor="#070b1d" />
        </radialGradient>
        <radialGradient id={moon} cx="0.35" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#e9dcc3" />
        </radialGradient>
        <linearGradient id={ground} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9ccd6" />
          <stop offset="1" stopColor="#7c8199" />
        </linearGradient>
        <mask id={cut}>
          <rect width="120" height="120" fill="#fff" />
          <circle cx="67" cy="52" r="17" fill="#000" />
        </mask>
        <clipPath id={`${cut}c`}>
          <circle cx="60" cy="60" r="49" />
        </clipPath>
      </defs>
      {/* stitched gold ring */}
      <circle cx="60" cy="60" r="58" fill={`url(#${rim})`} />
      <circle cx="60" cy="60" r="53.5" fill="none" stroke="#7a4410" strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="2.2 2.2" />
      <circle cx="60" cy="60" r="50" fill="#070b1d" />
      <g clipPath={`url(#${cut}c)`}>
        <circle cx="60" cy="60" r="50" fill={`url(#${sky})`} />
        {/* the crescent Moon */}
        <circle cx="56" cy="56" r="20" fill={`url(#${moon})`} mask={`url(#${cut})`} />
        {/* the small Earth */}
        <circle cx="86" cy="40" r="5.5" fill="#2f7fd8" />
        <path d="M82.2 38.6c1.6-1.8 4.3-2.4 6.2-1.2-.6 1.5-2.6 2-3.4 3.6-.6 1.2-2.2 1-3.2.4z" fill="#7fe0a0" opacity="0.9" />
        <circle cx="86" cy="40" r="5.5" fill="none" stroke="#5ee0ff" strokeOpacity="0.5" strokeWidth="0.8" />
        {/* the horizon and the base */}
        <path d="M8 92 C30 82 48 86 60 84 C76 82 92 80 112 88 L112 120 L8 120 Z" fill={`url(#${ground})`} />
        <path d="M44 86 a9 7 0 0 1 18 0 z" fill="#fff3dd" />
        <rect x="47" y="83.6" width="2.2" height="1.6" rx="0.4" fill="#ffc56b" />
        <rect x="52" y="83.2" width="2.2" height="1.6" rx="0.4" fill="#ffc56b" />
        <rect x="57" y="83.6" width="2.2" height="1.6" rx="0.4" fill="#ffc56b" />
        <path d="M70 86 l3 -8 l3 8 z" fill="#e9dcc3" />
        <rect x="72.4" y="74" width="1.2" height="5" fill="#e9dcc3" />
      </g>
      {/* seven days */}
      {stars.map((s, i) => (
        <path
          key={i}
          transform={`translate(${s.x} ${s.y}) scale(${s.big ? 0.42 : 0.22}) translate(-12 -12)`}
          d="M12 0 L14.6 9.4 L24 12 L14.6 14.6 L12 24 L9.4 14.6 L0 12 L9.4 9.4 Z"
          fill={s.big ? '#ffc56b' : '#fff3dd'}
        />
      ))}
      {/* a soft shine on the ring */}
      <path d="M18 34 A48 48 0 0 1 60 10" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * A cadet's crew mark: a night-blue disc with the call sign's first letter in the patch colour, inside a thin
 * orbit ring with one small moon on it. Calm and grown-up (it replaced a cartoon helmet, 15 Nov). `empty` draws
 * the dashed orbit of a seat waiting for a new cadet.
 */
export function CrewMark({ color, letter, size = 76, empty = false }: { color: string; letter?: string; size?: number; empty?: boolean }) {
  const id = useId().replace(/:/g, '');
  const disc = `disc${id}`;
  // the small moon on the orbit, up and to the right
  const a = (-50 * Math.PI) / 180;
  const mx = 50 + Math.cos(a) * 46;
  const my = 50 + Math.sin(a) * 46;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`crew-mark ${empty ? 'crew-mark-empty' : ''}`} aria-hidden="true">
      <defs>
        <radialGradient id={disc} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#24305f" />
          <stop offset="1" stopColor="#0c1230" />
        </radialGradient>
      </defs>
      <circle
        className="crew-orbit"
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke={color}
        strokeOpacity={empty ? 0.75 : 0.55}
        strokeWidth="1.6"
        strokeDasharray={empty ? '4 5' : undefined}
      />
      <circle cx="50" cy="50" r="37" fill={`url(#${disc})`} />
      <circle cx="50" cy="50" r="37" fill="none" stroke="#fff" strokeOpacity="0.08" strokeWidth="1" />
      {empty ? (
        <path d="M50 37 v26 M37 50 h26" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      ) : (
        <text x="50" y="51" textAnchor="middle" dominantBaseline="central" fontSize="34" fontWeight="700" fill={color} style={{ fontFamily: 'inherit' }}>
          {letter}
        </text>
      )}
      {!empty && <circle cx={mx} cy={my} r="4.2" fill={color} />}
    </svg>
  );
}
