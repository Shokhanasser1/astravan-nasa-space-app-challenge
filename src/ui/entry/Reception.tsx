import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowRight, Check, ChevronLeft, Lock, Medal, Play, Plus } from 'lucide-react';
import {
  PATCHES,
  PATCH_HEX,
  canCreate,
  freeSigns,
  rank,
  toNextRank,
  type MissionRecord,
  type Patch,
  type Profile,
  type Sign,
} from '../../profile/profiles';
import type { Lang } from '../../i18n/t';
import type { Tr } from '../play/kit';
import { CrewMark, Star } from './art';

/**
 * The way into the game (docs/specs/2026-11-15-entry.md). Minimal, for 7–12-year-olds: few words, big targets,
 * icons first. Like a hotel: the desk (title + CAPCOM's one-line briefing), "Who is playing?" (cadet badges as
 * avatars, a new cadet, or play as guest), then your room key (the lobby) and the Moon base.
 *
 * Cadet = long-term (missions and titles stay); guest = short-term (one mission, nothing saved).
 * No name, e-mail, age or date is ever asked: a badge is a call sign picked from a list and a patch colour.
 */
export interface ReceptionProps {
  tr: Tr;
  lang: Lang;
  sound: boolean;
  profiles: Profile[];
  /** The badge checked in, 'guest', or null at the desk. */
  current: Profile | 'guest' | null;
  /** The mission a guest just finished, offered to keep on a new badge. */
  guestResult: MissionRecord | null;
  /** The checked-in badge has a mission in progress. */
  canContinue: boolean;
  onGuest: () => void;
  onPick: (id: string) => void;
  onCreate: (sign: Sign, patch: Patch) => void;
  onStart: () => void;
  onContinue: () => void;
  onLeave: () => void;
  onRemove: (id: string) => void;
}

export function Reception(p: ReceptionProps) {
  const [making, setMaking] = useState(false);
  // (Leaving the desk or checking in closes the badge maker.)
  useEffect(() => setMaking(false), [p.current]);

  const cadet = p.current && p.current !== 'guest' ? p.current : null;
  const desk = !cadet && !making;
  return (
    <div className={`entry-wrap pointer-events-auto ${desk ? 'entry-at-desk' : ''}`} data-testid="reception">
      <div className="entry-scrim" aria-hidden="true" />
      <TitleLockup tr={p.tr} />
      {desk ? (
        <Desk {...p} onMake={() => setMaking(true)} />
      ) : (
        <div className="entry-card glass holo-in">
          {cadet ? (
            <Lobby {...p} cadet={cadet} />
          ) : (
            <BadgeMaker tr={p.tr} profiles={p.profiles} keep={p.guestResult} onBack={() => setMaking(false)} onCreate={p.onCreate} />
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- desk */

/**
 * The title, drawn over the 3D base: "HOME BY" small and wide, "SEVEN" big, and seven day marks — the whole game in
 * one look (a week on the Moon, home by Day 7). No voice here: the desk is quiet.
 */
function TitleLockup({ tr }: { tr: Tr }) {
  return (
    <header className="entry-lockup" data-testid="briefing">
      <h1 className="entry-logo" aria-label={tr('ui.start.title')}>
        <span className="entry-logo-top" aria-hidden="true">
          {tr('ui.entry.logoTop')}
        </span>
        <span className="entry-logo-big" aria-hidden="true">
          {tr('ui.entry.logoBig')}
        </span>
      </h1>
      <div className="entry-days" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <Star key={i} size={i === 6 ? 18 : 10} className={i === 6 ? 'entry-day entry-day-home' : 'entry-day'} />
        ))}
      </div>
      <p className="entry-tagline">{tr('ui.entry.tagline')}</p>
    </header>
  );
}

/**
 * The desk, minimal: one quiet card — "Who is playing?", the crew as marks in their patch colours, then one line
 * to play as a guest (once, nothing kept). No ornament: the crew marks and the gold "go" carry the look.
 */
function Desk({ tr, profiles, guestResult, onGuest, onPick, onMake }: ReceptionProps & { onMake: () => void }) {
  const room = canCreate(profiles);
  return (
    <div className="entry-card pass">
      <section className="pass-main" aria-labelledby="who-h">
        {guestResult && (
          <div className="entry-keep" data-testid="keep-result">
            <Medal size={24} className="shrink-0 text-[var(--gold)]" aria-hidden="true" />
            <span className="min-w-0 flex-1 font-semibold">{tr(guestResult.titleKey)}</span>
            {room && (
              <button type="button" className="abtn primary" data-testid="keep-make" onClick={onMake}>
                {tr('ui.entry.keep')}
              </button>
            )}
          </div>
        )}
        <h2 id="who-h" className="pass-title">
          {tr('ui.entry.who')}
        </h2>
        <div className="crew">
          {profiles.map((pr) => (
            <button key={pr.id} type="button" className="crew-seat" data-testid={`badge-${pr.id}`} onClick={() => onPick(pr.id)}>
              <CrewMark color={PATCH_HEX[pr.patch]} letter={pr.sign[0].toUpperCase()} />
              <span className="crew-name">{tr(`ui.sign.${pr.sign}`)}</span>
            </button>
          ))}
          {room && (
            <button type="button" className="crew-seat crew-seat-new" data-testid="badge-new" onClick={onMake}>
              <CrewMark color="#7fe3ff" empty />
              <span className="crew-name">{tr('ui.entry.new')}</span>
            </button>
          )}
        </div>
      </section>
      <div className="pass-stub">
        <button type="button" className="pass-guest" data-testid="start-mission" onClick={onGuest}>
          <span className="pass-guest-icon" aria-hidden="true">
            <Play size={18} strokeWidth={2.5} fill="currentColor" />
          </span>
          <span className="pass-guest-text">
            <span className="pass-guest-label">{tr('ui.entry.guest')}</span>
            <span className="pass-guest-hint">{tr('ui.entry.guestHint')}</span>
          </span>
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- badge maker */

function BadgeMaker({
  tr,
  profiles,
  keep,
  onBack,
  onCreate,
}: {
  tr: Tr;
  profiles: Profile[];
  keep: MissionRecord | null;
  onBack: () => void;
  onCreate: (sign: Sign, patch: Patch) => void;
}) {
  const signs = freeSigns(profiles);
  const [sign, setSign] = useState<Sign>(signs[0]);
  const [patch, setPatch] = useState<Patch>('ice');
  const preview: Profile = { id: sign, sign, patch, missions: keep ? [keep] : [] };
  return (
    <div className="entry-stack" data-testid="badge-maker">
      <div className="entry-bar">
        <button type="button" className="abtn entry-icon-btn" data-testid="maker-back" onClick={onBack} aria-label={tr('ui.entry.make.back')}>
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <h2 className="entry-h2">{tr('ui.entry.make.title')}</h2>
        <span className="entry-icon-btn" aria-hidden="true" />
      </div>

      <div className="entry-preview">
        <CrewMark color={PATCH_HEX[patch]} letter={sign[0].toUpperCase()} size={104} />
        <div className="entry-preview-name">{tr(`ui.sign.${sign}`)}</div>
        <RankChip tr={tr} profile={preview} />
      </div>

      <div className="entry-field" role="radiogroup" aria-label={tr('ui.entry.make.sign')}>
        <span className="eyebrow">{tr('ui.entry.make.sign')}</span>
        <div className="entry-signs">
          {signs.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={sign === s}
              data-testid={`sign-${s}`}
              className={`entry-chip ${sign === s ? 'entry-chip-on' : ''}`}
              onClick={() => setSign(s)}
            >
              {tr(`ui.sign.${s}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="entry-field" role="radiogroup" aria-label={tr('ui.entry.make.patch')}>
        <span className="eyebrow">{tr('ui.entry.make.patch')}</span>
        <div className="entry-swatches">
          {PATCHES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={patch === c}
              aria-label={tr(`ui.patch.${c}`)}
              data-testid={`patch-${c}`}
              className={`entry-swatch ${patch === c ? 'entry-swatch-on' : ''}`}
              style={{ '--patch': PATCH_HEX[c] } as CSSProperties}
              onClick={() => setPatch(c)}
            >
              {patch === c && <Check size={22} strokeWidth={3} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="abtn primary big w-full" data-testid="maker-print" onClick={() => onCreate(sign, patch)}>
        {tr('ui.entry.make.done')}
        <ArrowRight size={20} aria-hidden="true" />
      </button>
      <p className="entry-hint entry-privacy">
        <Lock size={12} aria-hidden="true" /> {tr('ui.entry.privacy')}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- lobby */

function Lobby({ tr, cadet, canContinue, onStart, onContinue, onLeave, onRemove }: ReceptionProps & { cadet: Profile }) {
  const [sure, setSure] = useState(false);
  const n = cadet.missions.length;
  return (
    <div className="entry-stack" data-testid="lobby">
      <div className="entry-bar">
        <button type="button" className="abtn entry-icon-btn" data-testid="lobby-leave" onClick={onLeave} aria-label={tr('ui.lobby.switch')}>
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <span className="entry-bar-label">{tr('ui.lobby.switch')}</span>
        <span className="entry-icon-btn" aria-hidden="true" />
      </div>

      <div className="entry-preview" data-testid="badge-card">
        <CrewMark color={PATCH_HEX[cadet.patch]} letter={cadet.sign[0].toUpperCase()} size={104} />
        <div className="entry-preview-name">{tr('ui.lobby.hi', { sign: tr(`ui.sign.${cadet.sign}`) })}</div>
        <RankChip tr={tr} profile={cadet} />
        <RankDots profile={cadet} />
      </div>

      <div className="flex flex-col gap-2">
        {canContinue && (
          <button type="button" className="abtn primary big w-full" data-testid="continue" onClick={onContinue}>
            <Play size={20} aria-hidden="true" />
            {tr('ui.lobby.continue')}
          </button>
        )}
        <button type="button" className={`abtn big w-full ${canContinue ? '' : 'primary'}`} data-testid="lobby-start" onClick={onStart}>
          {tr('ui.lobby.start', { n: n + 1 })}
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </div>

      {n > 0 && (
        <section className="entry-medals" aria-labelledby="medals-h">
          <h3 id="medals-h" className="eyebrow">
            {tr('ui.lobby.medals')}
          </h3>
          <ol className="entry-medal-list" data-testid="mission-log">
            {cadet.missions.map((m, i) => (
              <li key={`${m.weekId}-${m.seed}`} className="entry-medal">
                <Medal size={18} className="shrink-0 text-[var(--c-power)]" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{tr(m.titleKey)}</span>
                <span className="entry-medal-n">{i + 1}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <button
        type="button"
        className="entry-remove"
        data-testid="lobby-remove"
        onClick={() => (sure ? onRemove(cadet.id) : setSure(true))}
        onBlur={() => setSure(false)}
      >
        {tr(sure ? 'ui.lobby.removeSure' : 'ui.lobby.remove')}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function RankChip({ tr, profile }: { tr: Tr; profile: Profile }) {
  return (
    <span className="entry-rank" style={{ '--patch': PATCH_HEX[profile.patch] } as CSSProperties}>
      {tr(`ui.rank.${rank(profile)}`)}
    </span>
  );
}

/** Missions flown towards the next rank, as dots: no words, no sums. */
function RankDots({ profile }: { profile: Profile }) {
  const next = toNextRank(profile);
  const n = profile.missions.length;
  // (Before the first mission a lone empty dot says nothing.)
  if (!next || n === 0) return null;
  return (
    <span className="entry-dots" data-testid="next-rank" aria-hidden="true">
      {Array.from({ length: n + next.left }, (_, i) => (
        <span key={i} className={i < n ? 'entry-dot entry-dot-on' : 'entry-dot'} />
      ))}
    </span>
  );
}
