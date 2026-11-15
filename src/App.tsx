import { useEffect, useMemo, useReducer, useState } from 'react';
import { Stage } from './scene/Stage';
import { Hud } from './ui/Hud';
import { FIRST_WEEK, initialModel, reducer, toView, truth, type Machine, type Model, type View } from './state/game';
import { SKY, WEEKS, pickWeek } from './engine/week';
import type { Lang } from './i18n/t';
import { audio } from './audio/audio';
import { ambienceFor } from './audio/ambience';
import { HDU_HABITAT } from './scene/layout';
import { roomState } from './walk/rooms';
import { musicFor } from './audio/music';
import { doseFor, levelOf, useRunHour } from './scene/runClock';
import { load, save } from './lib/storage';
import { demoModel, isDemoKind } from './state/demo';
import { features } from './config/features';
import { flush } from './net/api';
import { Reception } from './ui/entry/Reception';
import { makeTr } from './ui/play/kit';
import {
  createProfile,
  playedKey,
  recordMission,
  removeProfile,
  sanitize,
  saveKey,
  type MissionRecord,
  type Patch,
  type Profile,
  type Sign,
} from './profile/profiles';

// Dev and shot.sh only: ?view={"plant":4,"wall":2} overrides the view so the scene can be checked without playing.
const params = new URLSearchParams(location.search);
const viewOverride: Partial<View> | null = (() => {
  if (!(import.meta.env.DEV || params.has('shot')) || !params.has('view')) return null;
  try {
    return JSON.parse(params.get('view')!) as Partial<View>;
  } catch {
    return null;
  }
})();

// Judge links (home story, src/state/demo.ts): ?demo=storm opens Day 4's morning, ?demo=launch Day 7's, the days
// before played with golden Plan A. A demo is a guest's game: nothing is saved. Without the param nothing changes.
const demoKind = params.get('demo');
const demo = isDemoKind(demoKind) ? demoModel(demoKind) : null;

/** Saved game: the model without the week (looked up again by id), so old saves survive a new weeks.json. */
type Saved = Omit<Model, 'week'> & { weekId: string };

/**
 * Who is playing (entry spec): a cadet badge (its id), a guest (nothing saved), or nobody yet (at the reception
 * desk). Without features.entry there is one shared save, as before.
 */
type Who = string | 'guest' | null;
const LEGACY = { game: 'game', played: 'played' };
function keysOf(who: Who): { game: string; played: string } | null {
  if (!features.entry) return LEGACY;
  return who && who !== 'guest' ? { game: saveKey(who), played: playedKey(who) } : null;
}

function loadSaved(key: string | undefined): Model | null {
  if (!key) return null;
  const s = load<Saved | null>(key, null);
  const week = s ? WEEKS.find((w) => w.id === s.weekId) : undefined;
  if (!s || !week || !s.game || s.screen !== 'game') return null;
  const { weekId: _, ...rest } = s;
  return { ...rest, week };
}

/** First mission is always 25–31 Oct 2021 (final version); a class code (?week=) wins; later a random real week. */
function chooseWeek(playedKey: string | undefined) {
  const played = playedKey ? load<boolean>(playedKey, false) : false;
  if (!params.has('week') && !played) return WEEKS.find((w) => w.id === FIRST_WEEK) ?? pickWeek(WEEKS, location.search);
  return pickWeek(WEEKS, location.search);
}

export function App() {
  const [model, dispatch] = useReducer(reducer, initialModel, (m) => demo ?? m);
  const [lang, setLangState] = useState<Lang>(() => load<Lang>('lang', 'en'));
  const [sound, setSound] = useState(true);
  // Badges on this device; the one checked in (remembered, so a returning cadet lands in their lobby).
  const [profiles, setProfiles] = useState<Profile[]>(() => (features.entry ? sanitize(load('profiles', [])) : []));
  const [who, setWho] = useState<Who>(() => {
    if (demo && features.entry) return 'guest'; // a demo plays as a guest; checking in at the desk later saves as usual
    const last = load<string | null>('lastBadge', null);
    return features.entry && last && profiles.some((p) => p.id === last) ? last : null;
  });
  const [guestResult, setGuestResult] = useState<MissionRecord | null>(null);
  // (without the desk there is one shared save: a demo visit leaves it alone)
  const keys = demo && !features.entry ? null : keysOf(who);
  const [saved, setSaved] = useState<Model | null>(() => loadSaved(keysOf(who)?.game));
  const tr = useMemo(() => makeTr(lang), [lang]);

  const storeProfiles = (list: Profile[]) => {
    setProfiles(list);
    save('profiles', list);
  };

  const view = useMemo(() => ({ ...toView(model, SKY), ...viewOverride }), [model]);

  useEffect(() => audio.setMuted(!sound), [sound]);
  // Dosimeter clicks (concept 3.0 §03): the day's measured dose ratio (LRO CRaTER, view.ratio) as Geiger clicks
  // while the crew is on the Moon — a quiet day ticks slowly, a storm day rattles. Silent with the sound off, on the
  // start and end screens, at the launch and on the truth screen.
  // The plan is made in the morning and the night card read in the evening, so they hear those real hours; while the
  // day runs, src/ui/play/DayRun.tsx plays it hour by hour (src/scene/runClock.ts).
  const onMoon = model.screen === 'game' && view.phase !== 'launch' && view.phase !== 'truth' && view.phase !== 'run';
  const doseRatio = sound && onMoon ? doseFor(view.phase, view.hourly, view.ratio ?? 0) : 0;
  useEffect(() => {
    if (view.phase !== 'run') audio.setDose(doseRatio);
  }, [doseRatio, view.phase]);
  // Breath in the suit outside, the habitat's hum inside (src/audio/ambience.ts); the day's level sets the breath.
  // (`?hdu`: walking in any HDU module's room is inside too; the room is read twice a second, not per frame.)
  const [inRoom, setInRoom] = useState(false);
  useEffect(() => {
    if (!HDU_HABITAT) return;
    const t = setInterval(() => setInRoom(roomState.id !== null), 500);
    return () => clearInterval(t);
  }, []);
  const amb = ambienceFor(model.screen, view.phase, inRoom);
  useEffect(() => audio.setAmbience(amb, view.level), [amb, view.level]);
  // Music (src/audio/music.ts): calm, storm (alert and storm days, stormy hours of the running day), finale.
  const runHour = useRunHour();
  const mood = musicFor(model.screen, view.phase, view.level, view.alert, runHour ? levelOf(runHour.ratio) : null);
  useEffect(() => audio.setMusic(mood), [mood]);
  useEffect(() => {
    if (features.sendResults) void flush();
  }, []);

  // A closed tab continues from the same day (developer guide §05). Saving may fail; the game goes on.
  // A guest's game is never saved.
  useEffect(() => {
    if (!keys) return;
    if (model.screen === 'game' && model.week) {
      const { week, ...rest } = model;
      save(keys.game, { ...rest, weekId: week.id } satisfies Saved);
    }
    if (model.phase === 'truth') save(keys.played, true);
    if (model.screen === 'end') {
      save(keys.game, null);
      setSaved(null);
    }
    // (keys change only at the desk, never during a game)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  // The truth screen writes the mission into the cadet's log (once), or keeps a guest's to offer a badge.
  useEffect(() => {
    if (!features.entry || model.phase !== 'truth' || !who) return;
    const t = truth(model);
    if (!t) return;
    const rec: MissionRecord = { weekId: t.weekId, titleKey: t.result.titleKey, crew: t.result.crew, science: t.result.science, seed: model.seed };
    if (who === 'guest') setGuestResult(rec);
    else storeProfiles(recordMission(profiles, who, rec));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.phase]);

  const setLang = (l: Lang) => {
    setLangState(l);
    save('lang', l);
  };
  const onTap = (k: Machine) => dispatch({ type: 'SET', k });
  const onUndo = (k: Machine) => dispatch({ type: 'SET', k, delta: -1 });
  const onStart = () => {
    const week = chooseWeek(keys?.played);
    if (!week) return;
    // A child's first mission (no finished mission on this badge) gets the Day 1 tutorial and the first-mission
    // cards, also when a class code picked another week. (Without a badge store: the first-mission week decides.)
    const played = keys ? load<boolean>(keys.played, false) : false;
    const firstMission = features.entry ? !played : undefined;
    // The seed only shuffles the day cards; it is drawn here, outside the pure engine and reducer.
    dispatch({ type: 'START', week, seed: Math.floor(Math.random() * 2 ** 31), firstMission });
    setSaved(null);
  };
  const onContinue = saved ? () => dispatch({ type: 'RESUME', model: saved }) : undefined;

  // ---- the reception desk (features.entry) ----
  const checkIn = (id: Who) => {
    setWho(id);
    save('lastBadge', id && id !== 'guest' ? id : null);
    setSaved(loadSaved(keysOf(id)?.game));
  };
  const current = who === 'guest' ? 'guest' : (profiles.find((p) => p.id === who) ?? null);
  const entry = features.entry ? (
    <Reception
      tr={tr}
      lang={lang}
      sound={sound}
      profiles={profiles}
      current={current}
      guestResult={guestResult}
      canContinue={Boolean(saved)}
      onGuest={() => {
        // A guest plays the first mission week (or the class code), straight away, and nothing is kept.
        setWho('guest');
        save('lastBadge', null);
        setSaved(null);
        setGuestResult(null);
        const week = chooseWeek(undefined);
        // (a guest is treated as a new child: the tutorial and the first-mission cards, whatever the week)
        if (week) dispatch({ type: 'START', week, seed: Math.floor(Math.random() * 2 ** 31), firstMission: true });
      }}
      onPick={(id) => checkIn(id)}
      onCreate={(sign: Sign, patch: Patch) => {
        const made = createProfile(profiles, sign, patch);
        if (!made.profile) return;
        let list = made.list;
        // A guest who just finished keeps that mission on the new badge (and the next one is a new real week).
        if (guestResult) {
          list = recordMission(list, made.profile.id, guestResult);
          save(playedKey(made.profile.id), true);
          setGuestResult(null);
        }
        storeProfiles(list);
        checkIn(made.profile.id);
      }}
      onStart={onStart}
      onContinue={() => saved && dispatch({ type: 'RESUME', model: saved })}
      onLeave={() => checkIn(null)}
      onRemove={(id) => {
        storeProfiles(removeProfile(profiles, id));
        save(saveKey(id), null);
        save(playedKey(id), null);
        checkIn(null);
      }}
    />
  ) : undefined;

  return (
    <>
      <Stage view={view} onTap={onTap} onUndo={features.controls ? onUndo : undefined} />
      <Hud
        model={model}
        view={view}
        dispatch={dispatch}
        lang={lang}
        setLang={setLang}
        sound={sound}
        setSound={setSound}
        onStart={onStart}
        onContinue={model.screen === 'game' ? undefined : onContinue}
        entry={entry}
      />
      {import.meta.env.DEV && !WEEKS.length && (
        <div className="fixed bottom-2 right-2 rounded bg-yellow-400 px-2 py-1 text-sm text-black">src/engine/weeks.json is missing</div>
      )}
    </>
  );
}
