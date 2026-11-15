import { useEffect, useRef, useState } from 'react';
import { Sun } from 'lucide-react';
import type { View } from '../../state/game';
import { audio } from '../../audio/audio';
import { doseFor, hourAt, levelOf, ratioAt, setRunHour, utcHour } from '../../scene/runClock';
import { Panel, type Tr } from './kit';
import { Mark } from './Holo';

/**
 * The day running by itself, hour by hour, on the real record (15 Nov, Shoxjahon aka: "the storm must follow the
 * real NASA data"): 24 bars of today's measured dose ratio (LRO CRaTER, weeks.json `hourly`) fill from 00 to 24 UTC
 * over the run, with DONKI's flare peaks and particle arrival marked at their hours. The hour being played drives the
 * dosimeter clicks and the storm in the air (src/scene/runClock.ts). Times only — the date stays hidden until the
 * truth screen. Bar height: log scale, ×1 → 4 %, ×1000 → 100 % (an hour rarely goes past ×1000).
 */
const barHeight = (ratio: number) => Math.max(4, Math.min(100, (Math.log10(Math.max(ratio, 1)) / 3) * 100 + 4));
const hh = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:00`;

export function DayRun({ view, ms, sound, tr }: { view: View; ms: number; sound: boolean; tr: Tr }) {
  const hourly = view.hourly ?? [];
  const dayRatio = view.ratio ?? 1;
  const [hour, setHour] = useState(0);
  const t0 = useRef(0);

  useEffect(() => {
    t0.current = performance.now();
    let raf = 0;
    let last = -1;
    const tick = () => {
      const h = hourAt(performance.now() - t0.current, ms);
      const whole = Math.floor(h);
      if (whole !== last) {
        last = whole;
        const r = ratioAt(view.hourly, h, dayRatio);
        setHour(whole);
        setRunHour({ hour: whole, ratio: r });
        audio.setDose(sound ? r : 0);
        audio.setAmbienceLevel(levelOf(r));
        // the day's real events, at their hours (DONKI): a strong flare (M5 and up, X) and the particles' arrival
        for (const f of view.flares ?? []) if (/^(X|M[5-9])/.test(f.cls) && Math.floor(utcHour(f.peak_utc)) === whole) audio.chime('flare');
        for (const p of view.particles ?? []) if (Math.floor(utcHour(p.first_seen_utc)) === whole) audio.chime('particles');
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setRunHour(null);
      // the evening's dose for the night card (the app sets it again on the next phase)
      audio.setDose(sound ? doseFor('night', view.hourly, dayRatio) : 0);
    };
  }, [ms, sound, view.hourly, view.flares, view.particles, dayRatio]);

  const now = ratioAt(view.hourly, hour, dayRatio);
  const flares = (view.flares ?? []).filter((f) => /^[MX]/.test(f.cls));
  const particles = view.particles ?? [];
  return (
    <Panel className="day-run pointer-events-none flex flex-col gap-2" data-testid="day-run">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{tr('ui.run.title')}</span>
        <span className={`tabular-nums text-sm font-bold ${levelOf(now) > 0 ? 'text-alert' : 'text-measured'}`} data-testid="day-run-now">
          {hh(hour)} UTC · ×{now >= 10 ? Math.round(now) : now.toFixed(1)}
        </span>
      </div>
      <div className="day-run-chart" role="img" aria-label={tr('ui.run.title')}>
        {Array.from({ length: 24 }, (_, h) => {
          const r = hourly[h];
          const shown = h <= hour;
          return (
            <span key={h} className="day-run-track">
              <span
                className={`day-run-bar ${typeof r === 'number' && levelOf(r) > 0 ? 'storm' : ''} ${shown ? '' : 'later'} ${typeof r === 'number' ? '' : 'gap'}`}
                style={{ height: `${barHeight(typeof r === 'number' ? r : 1)}%` }}
              />
            </span>
          );
        })}
        {flares.map((f) => (
          <span key={`f${f.peak_utc}`} className="day-run-mark flare" style={{ left: `${(utcHour(f.peak_utc) / 24) * 100}%` }} title={f.source}>
            {utcHour(f.peak_utc) <= hour + 1 && (
              <>
                <Sun size={12} aria-hidden="true" /> {f.cls}
              </>
            )}
          </span>
        ))}
        {particles.map((p) => (
          <span key={`p${p.first_seen_utc}`} className="day-run-mark particles" style={{ left: `${(utcHour(p.first_seen_utc) / 24) * 100}%` }} title={p.source}>
            {utcHour(p.first_seen_utc) <= hour + 1 ? tr('ui.run.particles') : ''}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between text-[0.7rem] text-[var(--text-3)]">
        <span>00:00</span>
        <span>
          {tr('ui.run.source')}
          <Mark label="measured" tr={tr} />
        </span>
        <span>24:00</span>
      </div>
    </Panel>
  );
}
