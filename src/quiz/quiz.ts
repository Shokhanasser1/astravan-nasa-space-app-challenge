/**
 * Mission quiz (15 Nov, Shoxjahon aka's request): short "radio checks" between days and a debrief at the end of the
 * mission, so a child of 7–12 shows they understood the week before the next mission opens.
 *
 * The one rule this module exists for: **a question only asks about a road the child has already walked.** Every
 * template is triggered by something in the played days — a day card they met (the clogged water filter, ice in a
 * crater…), a storm day they lived, a wall they built, the air and water they ran low on — or by something every
 * player does from the first minute (walking at Moon gravity, the radio from Earth). Nothing from a day not played
 * yet, and the week's date is never in a question (it stays hidden until the truth screen).
 *
 * Real numbers come from the week itself (LRO CRaTER ratio = measured, DONKI flare class = measured) or from
 * public/data/facts.json; game-rule numbers come from the engine's P table. Each one carries its label and source.
 *
 * Pure: no React, DOM or unseeded random. Same week + game + picks + seed → the same questions, so nothing about
 * the quiz has to be saved: a reload asks the same question again.
 */
import { P, type CardId, type DayRecord, type State } from '../engine/rules';
import type { DataLabel, Week, WeekDay } from '../engine/week';

/** When the quiz asks (game rule, set by the team): a radio check on these nights, then the debrief. */
export const QUIZ = { nights: [2, 4, 6], perNight: 1, debrief: 3 } as const;

export type Topic = 'water' | 'radiation' | 'garden' | 'power' | 'moon';
export type IconName =
  | 'droplet' | 'wind' | 'sprout' | 'hammer' | 'house' | 'housePlus' | 'pickaxe' | 'sun' | 'zap' | 'flame'
  | 'snowflake' | 'battery' | 'radiation' | 'minus' | 'clock' | 'help' | 'feather' | 'radio' | 'bed' | 'footprints'
  | 'up' | 'down' | 'gauge' | 'shirt' | 'calendar' | 'ban' | 'wrench' | 'timer' | 'hourglass' | 'sparkles';

/** A line of text: an i18n key and its values (numbers are formatted here, words come from the language files). */
export interface Text {
  key: string;
  vars?: Record<string, string | number>;
}

export interface QuizOption {
  id: string;
  text: Text;
  icon: IconName;
}

export interface Question {
  /** Unique within a mission: template + day. */
  id: string;
  template: string;
  topic: Topic;
  /** The played day the question is about (none for questions about the whole Moon stay). */
  day?: number;
  prompt: Text;
  /** In the order to show them (shuffled with the mission's seed). */
  options: QuizOption[];
  answer: string;
  /** Shown after any answer: why, with the child's own numbers from that day. */
  why: Text;
  /** The mark and the source (an i18n key) of the number in `why` (none when it holds no number). */
  label?: DataLabel;
  source?: string;
}

export interface QuizInput {
  week: Week;
  game: State;
  /** Day → the day card answer, e.g. { 3: 'filter:wait' } (Model.picks). Old saves have none. */
  picks?: Record<number, string>;
  seed: number;
}

// ---- sources: i18n keys of named instruments and documents, never "NASA says" (game rules: src/engine/rules.ts) ----
const SRC = {
  crater: 'quiz.src.crater',
  donki: 'quiz.src.donki',
  rules: 'quiz.src.rules',
  lcross: 'quiz.src.lcross',
  moonSheet: 'quiz.src.moonSheet',
  radio: 'quiz.src.radio',
};

// ---- helpers ----
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: readonly T[], rnd: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A measured ratio as a child reads it: 1.0, 9.2, 42, 3692. */
export function fmtRatio(r: number): string {
  if (r >= 10) return String(Math.round(r));
  return r.toFixed(1);
}

/** Two significant figures, for "about …×" choices that differ by ten times: 0.92, 9.2, 92, 3700. */
export function sig2(r: number): string {
  if (r <= 0) return '0';
  const p = Math.floor(Math.log10(r)) - 1;
  const v = Math.round(r / 10 ** p) * 10 ** p;
  return p < 0 ? v.toFixed(-p) : String(v);
}

const isX = (cls: string) => /^X/i.test(cls);

/** What the child lived through, day by day (only played days). */
interface Lived {
  rec: DayRecord;
  data: WeekDay | undefined;
  card: CardId | null;
  pick: string | null; // 'wait', 'swap' … (without the card name)
  airBefore: number;
  plantBefore: number;
  wallAfter: number;
}

function lived(input: QuizInput): Lived[] {
  const { game, week, picks = {} } = input;
  return game.days.map((rec, i) => {
    const prev = game.days[i - 1];
    const next = game.days[i + 1];
    const raw = picks[rec.day];
    const card = game.cards[rec.day - 1] ?? null;
    const pick = raw && card && raw.startsWith(`${card}:`) ? raw.split(':')[1] : null;
    return {
      rec,
      data: week.days.find((d) => d.day === rec.day),
      card,
      pick,
      airBefore: prev ? prev.air : P.startAir,
      plantBefore: prev ? prev.plant : P.startPlant,
      wallAfter: next ? next.wall : game.wall,
    };
  });
}

/** A candidate before shuffling: how much it is worth asking now (higher = closer to what just happened). */
interface Cand {
  q: Omit<Question, 'options'> & { options: QuizOption[] };
  priority: number;
}

const opt = (template: string, id: string, icon: IconName, vars?: Text['vars']): QuizOption => ({
  id,
  icon,
  text: { key: `quiz.${template}.a.${id}`, vars },
});

const dayVars = (day: number, extra: Text['vars'] = {}) => ({ day, ...extra });

// ---- the templates: each one fires only on something the child has lived ----

/** Questions about one played day (cards, storms, the wall, the reserve). */
function dayTemplates(l: Lived): Cand[] {
  const { rec, data, card, pick } = l;
  const d = rec.day;
  const out: Cand[] = [];
  const ratio = data?.ratio ?? 1;

  // WATER — the backup tank switched on (air and water hit 0 that night)
  if (rec.air <= 0) {
    out.push({
      priority: 5,
      q: {
        id: `emergency-${d}`, template: 'emergency', topic: 'water', day: d,
        prompt: { key: 'quiz.emergency.q', vars: dayVars(d) },
        options: [opt('emergency', 'ranOut', 'droplet'), opt('emergency', 'storm', 'radiation'), opt('emergency', 'dust', 'sun')],
        answer: 'ranOut',
        why: { key: 'quiz.emergency.why', vars: dayVars(d, { use: P.crewUse }) },
        label: 'rule', source: SRC.rules,
      },
    });
  }

  // WATER — the clogged water filter card
  if (card === 'filter' && pick) {
    out.push({
      priority: 4,
      q: {
        id: `filter-${d}`, template: 'filter', topic: 'water', day: d,
        prompt: { key: 'quiz.filter.q', vars: dayVars(d) },
        options: [opt('filter', 'down', 'down'), opt('filter', 'garden', 'sprout'), opt('filter', 'nothing', 'minus')],
        answer: 'down',
        why: { key: `quiz.filter.why.${pick === 'wait' ? 'wait' : 'swap'}`, vars: dayVars(d, { from: l.airBefore, to: rec.air }) },
        label: 'rule', source: SRC.rules,
      },
    });
  }

  // WATER — ice in a dark crater (the card), with the real LCROSS find
  if (card === 'ice' && pick) {
    out.push({
      priority: 3,
      q: {
        id: `ice-${d}`, template: 'ice', topic: 'water', day: d,
        prompt: { key: 'quiz.ice.q', vars: dayVars(d) },
        options: [opt('ice', 'water', 'droplet'), opt('ice', 'cold', 'snowflake'), opt('ice', 'shine', 'sparkles')],
        answer: 'water',
        why: { key: 'quiz.ice.why', vars: { year: 2009 } },
        label: 'measured', source: SRC.lcross,
      },
    });
  }

  // WATER — the daily reserve (always lived; worth more when it went down)
  out.push({
    priority: rec.air < l.airBefore ? 2.5 : 1.5,
    q: {
      id: `reserve-${d}`, template: 'reserve', topic: 'water', day: d,
      prompt: { key: 'quiz.reserve.q' },
      options: [opt('reserve', 'ls', 'wind'), opt('reserve', 'gh', 'sprout'), opt('reserve', 'ws', 'hammer')],
      answer: 'ls',
      why: { key: 'quiz.reserve.why', vars: dayVars(d, { use: P.crewUse, air: rec.air }) },
      label: 'rule', source: SRC.rules,
    },
  });

  // RADIATION — a big X-class flare that day (DONKI): did the meter at the base jump? (loud ≠ dangerous)
  const xFlare = data?.flares.find((f) => isX(f.cls));
  if (xFlare && (ratio < 2 || ratio >= 10)) {
    out.push({
      priority: 4,
      q: {
        id: `flare-${d}`, template: 'flare', topic: 'radiation', day: d,
        prompt: { key: 'quiz.flare.q', vars: dayVars(d, { cls: xFlare.cls }) },
        options: [opt('flare', 'calm', 'gauge'), opt('flare', 'high', 'up'), opt('flare', 'off', 'ban')],
        answer: ratio < 2 ? 'calm' : 'high',
        why: { key: ratio < 2 ? 'quiz.flare.why.calm' : 'quiz.flare.why.high', vars: dayVars(d, { cls: xFlare.cls, ratio: fmtRatio(ratio) }) },
        label: 'measured', source: SRC.donki,
      },
    });
  }

  // RADIATION — how many times normal (a real storm day, ≥ 5× normal): ten times less, right, ten times more
  if (ratio >= 5) {
    out.push({
      priority: 4,
      q: {
        id: `times-${d}`, template: 'times', topic: 'radiation', day: d,
        prompt: { key: 'quiz.times.q', vars: dayVars(d) },
        options: [
          opt('times', 'low', 'down', { n: sig2(ratio / 10) }),
          opt('times', 'right', 'radiation', { n: sig2(ratio) }),
          opt('times', 'high', 'up', { n: sig2(ratio * 10) }),
        ],
        answer: 'right',
        why: { key: 'quiz.times.why', vars: dayVars(d, { ratio: fmtRatio(ratio) }) },
        label: 'measured', source: SRC.crater,
      },
    });
  }

  // RADIATION — an alert day: why was the level a "?"
  if (data?.alert) {
    out.push({
      priority: 3,
      q: {
        id: `alert-${d}`, template: 'alert', topic: 'radiation', day: d,
        prompt: { key: 'quiz.alert.q', vars: dayVars(d) },
        options: [opt('alert', 'unknown', 'help'), opt('alert', 'broken', 'wrench'), opt('alert', 'quiet', 'feather')],
        answer: 'unknown',
        why: { key: 'quiz.alert.why', vars: dayVars(d, { ratio: fmtRatio(ratio) }) },
        label: 'measured', source: SRC.crater,
      },
    });
  }

  // RADIATION — a storm reached the base that day: where is the crew safest?
  if (rec.stormRaw > 0) {
    const pct = Math.round((1 - rec.stormGot / rec.stormRaw) * 100);
    out.push({
      priority: 3.5,
      q: {
        id: `shelter-${d}`, template: 'shelter', topic: 'radiation', day: d,
        prompt: { key: 'quiz.shelter.q', vars: dayVars(d) },
        options: [
          { id: 'full', icon: 'house', text: { key: 'ui.shelter.full' } },
          { id: 'half', icon: 'housePlus', text: { key: 'ui.shelter.half' } },
          { id: 'none', icon: 'pickaxe', text: { key: 'ui.shelter.none' } },
        ],
        answer: 'full',
        why: { key: `quiz.shelter.why.${rec.shelter}`, vars: dayVars(d, { pct }) },
        label: 'rule', source: SRC.rules,
      },
    });
  }

  // RADIATION — a wall level built that day
  if (l.wallAfter > rec.wall) {
    out.push({
      priority: 3,
      q: {
        id: `wall-${d}`, template: 'wall', topic: 'radiation', day: d,
        prompt: { key: 'quiz.wall.q', vars: dayVars(d) },
        options: [opt('wall', 'tomorrow', 'calendar'), opt('wall', 'now', 'zap'), opt('wall', 'never', 'ban')],
        answer: 'tomorrow',
        why: { key: 'quiz.wall.why', vars: { pct: Math.round(P.wallBlock * 100), level: l.wallAfter } },
        label: 'rule', source: SRC.rules,
      },
    });
  }

  // GARDEN — the ridge shadow card
  if (card === 'shadow' && pick) {
    out.push({
      priority: 3,
      q: {
        id: `shadow-${d}`, template: 'shadow', topic: 'garden', day: d,
        prompt: { key: 'quiz.shadow.q', vars: dayVars(d) },
        options: [opt('shadow', 'heat', 'flame'), opt('shadow', 'water', 'droplet'), opt('shadow', 'dark', 'minus')],
        answer: 'heat',
        // (heated, yet the garden fell: the greenhouse batteries were short — say so, or the "why" contradicts the night)
        why: {
          key: `quiz.shadow.why.${pick !== 'heat' ? 'cool' : rec.plant < l.plantBefore ? 'heatLow' : 'heat'}`,
          vars: dayVars(d, { from: l.plantBefore, to: rec.plant }),
        },
        label: 'rule', source: SRC.rules,
      },
    });
  }

  // GARDEN — the garden moved that day
  if (rec.plant !== l.plantBefore) {
    out.push({
      priority: 2,
      q: {
        id: `garden-${d}`, template: 'garden', topic: 'garden', day: d,
        prompt: { key: 'quiz.garden.q' },
        options: [opt('garden', 'two', 'battery'), opt('garden', 'none', 'ban'), opt('garden', 'wall', 'hammer')],
        answer: 'two',
        why: { key: 'quiz.garden.why', vars: dayVars(d, { plant: rec.plant, max: P.maxPlant }) },
        label: 'rule', source: SRC.rules,
      },
    });
  }

  // POWER — dust on the solar wing
  if (card === 'dust' && pick) {
    out.push({
      priority: 3,
      q: {
        id: `dust-${d}`, template: 'dust', topic: 'power', day: d,
        prompt: { key: 'quiz.dust.q', vars: dayVars(d) },
        options: [opt('dust', 'less', 'battery'), opt('dust', 'more', 'zap'), opt('dust', 'nothing', 'minus')],
        answer: 'less',
        why: { key: `quiz.dust.why.${pick === 'brush' ? 'brush' : 'leave'}`, vars: dayVars(d) },
        label: 'rule', source: SRC.rules,
      },
    });
  }

  // POWER — an early sunrise (no choice on this card: the day itself is enough)
  if (card === 'sunrise') {
    out.push({
      priority: 2.5,
      q: {
        id: `sunrise-${d}`, template: 'sunrise', topic: 'power', day: d,
        prompt: { key: 'quiz.sunrise.q', vars: dayVars(d) },
        options: [opt('sunrise', 'battery', 'battery'), opt('sunrise', 'air', 'wind'), opt('sunrise', 'storm', 'radiation')],
        answer: 'battery',
        why: { key: 'quiz.sunrise.why', vars: dayVars(d) },
        label: 'rule', source: SRC.rules,
      },
    });
  }

  // CREW — the tired crew card
  if (card === 'tired' && pick) {
    out.push({
      priority: 2.5,
      q: {
        id: `tired-${d}`, template: 'tired', topic: 'power', day: d,
        prompt: { key: 'quiz.tired.q', vars: dayVars(d) },
        options: [opt('tired', 'rest', 'bed'), opt('tired', 'push', 'footprints'), opt('tired', 'explore', 'pickaxe')],
        answer: 'rest',
        why: { key: `quiz.tired.why.${pick === 'rest' ? 'rest' : 'push'}`, vars: dayVars(d) },
        label: 'rule', source: SRC.rules,
      },
    });
  }

  return out;
}

/** Questions about the days so far together: the strongest radiation day (needs a real storm and three days). */
function windowTemplates(played: Lived[]): Cand[] {
  const out: Cand[] = [];
  const withData = played.filter((l) => l.data);
  if (withData.length >= 3) {
    const byRatio = [...withData].sort((a, b) => b.data!.ratio - a.data!.ratio || a.rec.day - b.rec.day);
    const top = byRatio[0];
    const second = byRatio[1];
    if (top.data!.ratio >= 2 && top.data!.ratio >= 1.5 * second.data!.ratio) {
      const low = byRatio[byRatio.length - 1];
      const mid = byRatio[Math.floor(byRatio.length / 2)]; // (≥ 3 days: never the top or the lowest)
      const days = [top, mid, low];
      out.push({
        priority: 3.5,
        q: {
          id: `peak-${top.rec.day}`, template: 'peak', topic: 'radiation', day: top.rec.day,
          prompt: { key: 'quiz.peak.q' },
          options: days.map((l) => ({ id: `d${l.rec.day}`, icon: 'calendar', text: { key: 'quiz.peak.a', vars: { day: l.rec.day } } })),
          answer: `d${top.rec.day}`,
          why: { key: 'quiz.peak.why', vars: { day: top.rec.day, ratio: fmtRatio(top.data!.ratio), low: fmtRatio(low.data!.ratio) } },
          label: 'measured', source: SRC.crater,
        },
      });
    }
  }
  return out;
}

/** Things every player has done from the first minute: walked and jumped at Moon gravity, heard the radio. */
function moonTemplates(): Cand[] {
  return [
    {
      priority: 1,
      q: {
        id: 'gravity', template: 'gravity', topic: 'moon',
        prompt: { key: 'quiz.gravity.q' },
        options: [opt('gravity', 'weak', 'feather'), opt('gravity', 'suit', 'shirt'), opt('gravity', 'air', 'wind')],
        answer: 'weak',
        why: { key: 'quiz.gravity.why', vars: { moon: 1.62, earth: 9.8, times: 6 } },
        label: 'measured', source: SRC.moonSheet,
      },
    },
    {
      priority: 1,
      q: {
        id: 'radio', template: 'radio', topic: 'moon',
        prompt: { key: 'quiz.radio.q' },
        options: [opt('radio', 'second', 'timer'), opt('radio', 'hour', 'clock'), opt('radio', 'day', 'hourglass')],
        answer: 'second',
        why: { key: 'quiz.radio.why', vars: { s: 1.3, km: '384 400' } },
        label: 'computed', source: SRC.radio,
      },
    },
  ];
}

/** Every question the days from..to (inclusive, played) can ask, best first, one per template. */
function candidates(input: QuizInput, from: number, to: number): Cand[] {
  const all = lived(input).filter((l) => l.rec.day <= to);
  const win = all.filter((l) => l.rec.day >= from);
  const list = [...win.flatMap((l) => dayTemplates(l)), ...windowTemplates(all), ...moonTemplates()];
  // one per template: the higher priority, then the later day (closest to now)
  const best = new Map<string, Cand>();
  for (const c of list) {
    const old = best.get(c.q.template);
    if (!old || c.priority > old.priority || (c.priority === old.priority && (c.q.day ?? 0) > (old.q.day ?? 0))) best.set(c.q.template, c);
  }
  return [...best.values()];
}

/**
 * Picks n: different templates, different topics while it can, the most important first (seeded tie-break). A topic
 * the mission already asked about counts 1.5 less, so one week touches water, radiation and the garden in turn.
 */
function choose(
  cands: Cand[], n: number, rnd: () => number, used: Set<string>, usedTopics: Set<Topic>, boost: (c: Cand) => number = () => 0,
): Question[] {
  const ranked = cands
    .filter((c) => !used.has(c.q.template))
    .map((c) => ({ c, score: c.priority + boost(c) - (usedTopics.has(c.q.topic) ? 1.5 : 0) + rnd() * 0.9 }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
  const out: Cand[] = [];
  const topics = new Set<Topic>();
  for (const c of ranked) {
    if (out.length >= n) break;
    if (!topics.has(c.q.topic)) {
      out.push(c);
      topics.add(c.q.topic);
    }
  }
  for (const c of ranked) {
    if (out.length >= n) break;
    if (!out.includes(c)) out.push(c);
  }
  return out.map((c) => ({ ...c.q, options: shuffle(c.q.options, rnd) }));
}

/** Is there a radio check on the night after this day? */
export const isQuizNight = (day: number) => (QUIZ.nights as readonly number[]).includes(day);

/** The questions of every radio check up to and including the night after `day`, in order. */
function nightsUpTo(input: QuizInput, day: number): { day: number; questions: Question[] }[] {
  const used = new Set<string>();
  const topics = new Set<Topic>();
  const out: { day: number; questions: Question[] }[] = [];
  let from = 1;
  for (const night of QUIZ.nights) {
    if (night > day || !input.game.days.some((r) => r.day === night)) break;
    const rnd = mulberry32(input.seed + night * 7919);
    const questions = choose(candidates(input, from, night), QUIZ.perNight, rnd, used, topics);
    questions.forEach((q) => {
      used.add(q.template);
      topics.add(q.topic);
    });
    out.push({ day: night, questions });
    from = night + 1;
  }
  return out;
}

/**
 * The radio check on the night after `day` (only the days played so far), or [] when tonight has none.
 * Earlier checks of this mission are never repeated.
 */
export function nightQuiz(input: QuizInput, day: number): Question[] {
  if (!isQuizNight(day)) return [];
  return nightsUpTo(input, day).find((n) => n.day === day)?.questions ?? [];
}

/**
 * The mission debrief after the truth screen: the whole week, nothing the radio checks already asked, and the
 * real radiation data first (the measured week is what the mission was about).
 */
export function debriefQuiz(input: QuizInput): Question[] {
  const nights = nightsUpTo(input, 7).flatMap((n) => n.questions);
  const used = new Set(nights.map((q) => q.template));
  const rnd = mulberry32(input.seed + 99991);
  const data = new Set(['times', 'peak', 'flare']);
  // (no topic penalty here: the debrief's three already take three different topics where the week allows)
  return choose(candidates(input, 1, 7), QUIZ.debrief, rnd, used, new Set(), (c) => (data.has(c.q.template) ? 3 : 0));
}

/** Stars for the debrief: answers right on the first try (0..n). */
export const stars = (firstTry: boolean[]) => firstTry.filter(Boolean).length;
