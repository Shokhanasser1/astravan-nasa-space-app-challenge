import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Lang } from '../../i18n/t';
import { audio } from '../../audio/audio';
import { telemetry } from '../../character/telemetry';
import { BODY, GRAVITY, MOVE, jumpHeight } from '../../character/physics.js';
import type { Tr } from './kit';

/**
 * Visor holograms (Shoxjahon aka, 15 Nov): mission control (CAPCOM) speaks as a hologram, the physics of a Moon
 * jump appears as a hologram card, the real Sun photo of the day, and the measured / computed / rule marks.
 * Text only through keys; every number comes from the engine, the physics constants (src/character/physics.js,
 * sources there) or the bundled NASA media manifest.
 */

export type DataLabel = 'measured' | 'computed' | 'rule' | 'story';

/** The mark every number carries: colour + word, never colour alone. */
export function Mark({ label, tr }: { label: DataLabel; tr: Tr }) {
  const tone = { measured: 'text-measured border-measured/60', computed: 'text-computed border-computed/60', rule: 'text-rule border-rule/60', story: 'text-story border-story/60' }[label];
  return (
    <span className={`ml-1 inline-block rounded-full border px-1.5 text-[0.65rem] font-semibold uppercase tracking-wide ${tone}`} data-label={label}>
      {tr(`ui.label.${label}`)}
    </span>
  );
}

export function HoloPanel({ className = '', children, ...rest }: { className?: string; children: ReactNode; 'data-testid'?: string }) {
  return (
    <div {...rest} className={`holo holo-in rounded-2xl px-3 py-2 ${className}`}>
      {children}
    </div>
  );
}

/** Mission control's face: a line-drawn head with a headset, glowing (it pulses slowly while speaking). */
function CapcomFace({ speaking }: { speaking: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={`h-11 w-11 shrink-0 ${speaking ? 'holo-pulse' : ''}`} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-measured">
        <circle cx="24" cy="20" r="9" />
        <path d="M8 44c2-9 8-13 16-13s14 4 16 13" />
        <path d="M14 20a10 10 0 0 1 20 0" />
        <rect x="11" y="18" width="4" height="7" rx="2" />
        <rect x="33" y="18" width="4" height="7" rx="2" />
        <path d="M35 25c0 4-3 6-7 6" />
      </g>
    </svg>
  );
}

/**
 * The radio line as a hologram of mission control. With sound on, the line is read aloud between the two Quindar
 * tones, like Apollo's radio (the browser's voice for English and Russian; Uzbek lines are recorded by the team).
 */
export function CapcomHolo({ textKey, tr, lang, sound }: { textKey: string | null; tr: Tr; lang: Lang; sound: boolean }) {
  const [speaking, setSpeaking] = useState(false);
  const text = textKey ? tr(textKey) : '';
  const say = () => {
    if (!text || lang === 'uz' || !('speechSynthesis' in window)) return;
    audio.unlock();
    audio.quindar('start');
    setSpeaking(true);
    window.setTimeout(() => {
      audio.speak(text, lang);
      const done = () => {
        if (window.speechSynthesis.speaking) return void window.setTimeout(done, 300);
        audio.quindar('end');
        setSpeaking(false);
      };
      window.setTimeout(done, 600);
    }, 280);
  };
  useEffect(() => {
    if (sound && textKey) say();
    // (A new line is read once; the button reads it again.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textKey]);
  if (!textKey) return null;
  return (
    <HoloPanel className="pointer-events-auto mx-auto flex max-w-md items-center gap-3" data-testid="radio">
      <CapcomFace speaking={speaking} />
      <div className="flex min-w-0 flex-col">
        <span className="text-[0.7rem] font-semibold uppercase tracking-widest text-measured">{tr('ui.capcom.name')}</span>
        <p className="text-base leading-snug">{text}</p>
      </div>
      {lang !== 'uz' && (
        <button type="button" className="ml-auto grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl" aria-label={tr('ui.capcom.speak')} onClick={say}>
          🔊
        </button>
      )}
    </HoloPanel>
  );
}

const fmt = (x: number, d = 2) => x.toFixed(d);
const MASS = BODY.personKg + BODY.suitKg;

/** After each jump: how high it was, what the same legs do on Earth, and why (h = v² / 2g; F = m·g). */
export function PhysicsHolo({ tr }: { tr: Tr }) {
  const t = useSyncExternalStore(telemetry.subscribe, telemetry.get);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!t.jumps) return;
    setShown(true);
    const id = window.setTimeout(() => setShown(false), 9000);
    return () => window.clearTimeout(id);
  }, [t.jumps]);
  if (!shown) return null;
  const v = MOVE.jumpV0;
  const moon = jumpHeight(v, GRAVITY.moon);
  const earth = jumpHeight(v, GRAVITY.earth);
  return (
    <HoloPanel className="pointer-events-none flex w-64 flex-col gap-1 self-end text-sm tabular-nums" data-testid="physics-holo">
      <span className="text-[0.7rem] font-semibold uppercase tracking-widest text-measured">{tr('ui.phys.title')}</span>
      <div>
        {tr('ui.phys.yours', { h: fmt(t.jump) })}
        <Mark label="computed" tr={tr} />
      </div>
      <div>
        {tr('ui.phys.earth', { h: fmt(earth), k: fmt(moon / earth, 1) })}
        <Mark label="computed" tr={tr} />
      </div>
      <div className="font-mono text-measured">
        h = v² / 2g = {fmt(v, 1)}² / (2 × {GRAVITY.moon})
      </div>
      <div>
        {tr('ui.phys.g', { g: GRAVITY.moon })}
        <Mark label="measured" tr={tr} />
      </div>
      <div className="font-mono text-measured">F = m · g</div>
      <div>
        {tr('ui.phys.weight', { m: MASS, n: Math.round(MASS * GRAVITY.moon), e: Math.round(MASS * GRAVITY.earth) })}
        <Mark label="computed" tr={tr} />
      </div>
    </HoloPanel>
  );
}

// ---- the real media of the week (public/data/media/<week>/manifest.json, built by scripts/data/fetch_media.py) ----
export interface WeekMedia {
  week: string;
  flare?: { begin: string; peak: string; source: string };
  credits: Record<string, string>;
  files: { file: string; credit: string; label: string }[];
}
const cache = new Map<string, Promise<WeekMedia | null>>();

function loadMedia(weekId: string): Promise<WeekMedia | null> {
  if (!cache.has(weekId)) {
    cache.set(
      weekId,
      fetch(`${import.meta.env.BASE_URL}data/media/${weekId}/manifest.json`)
        .then((r) => (r.ok ? (r.json() as Promise<WeekMedia>) : null))
        .catch(() => null),
    );
  }
  return cache.get(weekId)!;
}

export function useWeekMedia(weekId?: string): WeekMedia | null {
  const [m, setM] = useState<WeekMedia | null>(null);
  useEffect(() => {
    setM(null);
    if (!weekId) return;
    let alive = true;
    void loadMedia(weekId).then((x) => alive && setM(x));
    return () => {
      alive = false;
    };
  }, [weekId]);
  return m;
}

const mediaUrl = (week: string, file: string) => `${import.meta.env.BASE_URL}data/media/${week}/${file}`;
/** Credit line of one file: its own `credit` key ('sdo', or 'helioviewer' for the 2012–2014 weeks). */
const creditOf = (m: WeekMedia, file: string) => m.credits[m.files.find((f) => f.file === file)?.credit ?? 'sdo'] ?? m.credits.sdo;
const utc = (iso: string) => iso.slice(11, 16);

/** On the flare's own day: the Sun as SDO photographed it. Only the UTC time — the date stays secret until the end. */
export function SunToday({ weekId, date, tr }: { weekId?: string; date?: string; tr: Tr }) {
  const media = useWeekMedia(weekId);
  if (!media?.flare || !date || media.flare.peak.slice(0, 10) !== date || !media.files.some((f) => f.file === 'sdo-peak.webp')) return null;
  return (
    <HoloPanel className="pointer-events-none flex w-56 items-center gap-2" data-testid="sun-today">
      <img src={mediaUrl(media.week, 'sdo-peak.webp')} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
      <div className="text-xs">
        <div>
          {tr('ui.sun.today', { time: utc(media.flare.peak) })}
          <Mark label="measured" tr={tr} />
        </div>
        <div className="text-xs opacity-80">{tr('ui.sun.by')}</div>
        <div className="text-[0.65rem] opacity-60">{creditOf(media, 'sdo-peak.webp')}</div>
      </div>
    </HoloPanel>
  );
}

/** On the truth screen: the flare before and at its peak, with the real date and time. */
export function SunTruth({ weekId, tr }: { weekId: string; tr: Tr }) {
  const media = useWeekMedia(weekId);
  if (!media?.flare) return null;
  const has = (f: string) => media.files.some((x) => x.file === f);
  if (!has('sdo-before.webp') || !has('sdo-peak.webp')) return null;
  return (
    <div className="flex flex-col items-center gap-1" data-testid="sun-truth">
      <p className="text-center text-sm">
        {tr('ui.truth.sun', { date: media.flare.peak.slice(0, 10), time: utc(media.flare.peak) })}
        <Mark label="measured" tr={tr} />
      </p>
      <div className="flex gap-3">
        {(['before', 'peak'] as const).map((k) => (
          <figure key={k} className="flex flex-col items-center gap-1">
            <img src={mediaUrl(media.week, `sdo-${k}.webp`)} alt="" className="h-24 w-24 rounded-full object-cover" />
            <figcaption className="text-xs opacity-80">{tr(`ui.truth.${k}`)}</figcaption>
          </figure>
        ))}
      </div>
      <p className="text-center text-[0.65rem] opacity-60">{creditOf(media, 'sdo-peak.webp')}</p>
    </div>
  );
}

/** The start screen: the mission in three lines, read aloud by mission control. */
export function Briefing({ tr, lang, sound }: { tr: Tr; lang: Lang; sound: boolean }) {
  return (
    <HoloPanel className="pointer-events-auto flex max-w-md flex-col gap-2" data-testid="briefing">
      <h1 className="text-center text-2xl font-bold tracking-widest">{tr('ui.start.title')}</h1>
      <CapcomHolo textKey="ui.start.brief" tr={tr} lang={lang} sound={sound} />
    </HoloPanel>
  );
}
