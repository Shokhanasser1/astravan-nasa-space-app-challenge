import { describe, expect, it } from 'vitest';
import { CARD_CHOICES, confirm, dayInfo, newGame, type Alloc, type CardId, type Shelter, type State } from '../engine/rules';
import { WEEKS, type Week } from '../engine/week';
import { reducer, initialModel, type Model } from '../state/game';
import { QUIZ, debriefQuiz, isQuizNight, nightQuiz, sig2, type Question, type QuizInput } from './quiz';
import en from '../i18n/en/quiz.json';
import uz from '../i18n/uz/quiz.json';
import ru from '../i18n/ru/quiz.json';
import enUi from '../i18n/en/ui.json';

/** A seeded player who makes all kinds of choices (so every template gets a chance to fire). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function playWeek(week: Week, seed: number, days = 7, cards?: CardId[]): QuizInput {
  const r = rng(seed);
  let game: State = newGame(week, { modules: ['wall'], seed, cards });
  const picks: Record<number, string> = {};
  while (game.day <= days) {
    const info = dayInfo(game, week);
    const shelters: Shelter[] = ['none', 'half', 'full'];
    const alloc: Alloc = {
      ls: Math.floor(r() * 4), gh: Math.floor(r() * 3), build: r() < 0.4 ? 2 : 0, sc: Math.floor(r() * 4), launch: 4,
      shelter: shelters[Math.floor(r() * 3)],
    };
    const choices = info.card ? CARD_CHOICES[info.card] : [];
    const card = choices.length && !game.forced ? `${info.card}:${choices[Math.floor(r() * choices.length)]}` : undefined;
    if (card) picks[game.day] = card;
    game = confirm(game, week, alloc, card);
  }
  return { week, game, picks, seed };
}

const days = (q: Question) => [q.day, q.prompt.vars?.day, q.why.vars?.day].filter((d): d is number => typeof d === 'number');
const keysOf = (q: Question) => [q.prompt.key, q.why.key, ...q.options.map((o) => o.text.key)];
const dict = { en, uz, ru } as Record<string, Record<string, string>>;

describe('mission quiz: only roads already walked', () => {
  const runs = WEEKS.flatMap((w) => [1, 2, 3, 4, 5].map((s) => ({ w, s })));

  it('the radio checks come on nights 2, 4, 6 only', () => {
    const input = playWeek(WEEKS[0], 1);
    for (let d = 1; d <= 7; d++) expect(nightQuiz(input, d).length > 0, `night ${d}`).toBe(isQuizNight(d));
    expect([...QUIZ.nights]).toEqual([2, 4, 6]);
  });

  it('a radio check never asks about a day that is not played yet (every real week, five players each)', () => {
    for (const { w, s } of runs) {
      for (const night of QUIZ.nights) {
        // the game as it stands on that night: only `night` days played
        const input = playWeek(w, s, night);
        const qs = nightQuiz(input, night);
        expect(qs.length, `${w.id} seed ${s} night ${night}`).toBe(QUIZ.perNight);
        for (const q of qs) for (const d of days(q)) expect(d, `${w.id} ${q.id}`).toBeLessThanOrEqual(night);
      }
    }
  });

  it('a mission never asks the same kind of question twice, and the debrief has three', () => {
    for (const { w, s } of runs) {
      const input = playWeek(w, s);
      const all = [...QUIZ.nights.flatMap((n) => nightQuiz(input, n)), ...debriefQuiz(input)];
      const templates = all.map((q) => q.template);
      expect(new Set(templates).size, `${w.id} seed ${s}: ${templates}`).toBe(templates.length);
      expect(debriefQuiz(input)).toHaveLength(QUIZ.debrief);
    }
  });

  it('every question has three choices, one right answer and words in en, uz and ru', () => {
    for (const { w, s } of runs) {
      const input = playWeek(w, s);
      for (const q of [...QUIZ.nights.flatMap((n) => nightQuiz(input, n)), ...debriefQuiz(input)]) {
        expect(q.options).toHaveLength(3);
        expect(new Set(q.options.map((o) => o.id)).size).toBe(3);
        expect(q.options.map((o) => o.id)).toContain(q.answer);
        for (const k of keysOf(q)) {
          if (k.startsWith('ui.')) expect((enUi as Record<string, string>)[k], k).toBeTruthy();
          else for (const lang of ['en', 'uz', 'ru']) expect(dict[lang][k], `${lang} ${k}`).toBeTruthy();
        }
        if (q.label) expect(q.source, q.id).toBeTruthy();
      }
    }
  });

  it('the same mission asks the same questions (nothing to save)', () => {
    const a = playWeek(WEEKS[3], 7);
    expect(debriefQuiz(a)).toEqual(debriefQuiz(playWeek(WEEKS[3], 7)));
    expect(nightQuiz(a, 4)).toEqual(nightQuiz(playWeek(WEEKS[3], 7), 4));
  });
});

describe('mission quiz: the child’s own week', () => {
  const first = () => WEEKS.find((w) => w.id === '2021-10-25')!;

  it('a clogged water filter that the child left is the radio check that night, with their own reserve', () => {
    const week = first();
    let game = newGame(week, { modules: ['wall'], seed: 3, cards: ['filter'] }); // filter on day 2
    const plan: Alloc = { ls: 2, gh: 1, build: 0, sc: 0, launch: 0, shelter: 'none' };
    game = confirm(game, week, plan);
    const before = game.air;
    game = confirm(game, week, plan, 'filter:wait');
    const [q] = nightQuiz({ week, game, picks: { 2: 'filter:wait' }, seed: 3 }, 2);
    expect(q.template).toBe('filter');
    expect(q.answer).toBe('down');
    expect(q.why).toEqual({ key: 'quiz.filter.why.wait', vars: { day: 2, from: before, to: game.air } });
  });

  it('the debrief of the first mission asks about the real measured storm, with the CRaTER number', () => {
    const input = playWeek(first(), 11);
    const qs = debriefQuiz(input);
    const data = qs.find((q) => ['times', 'peak', 'flare'].includes(q.template));
    expect(data, qs.map((q) => q.template).join()).toBeDefined();
    expect(data!.label).toBe('measured');
    if (data!.template === 'times') {
      const d = first().days.find((x) => x.day === data!.day)!;
      expect(data!.options.find((o) => o.id === 'right')!.text.vars!.n).toBe(sig2(d.ratio));
    }
  });

  it('a big X flare on a calm day (false alarm week) teaches "loud is not dangerous"', () => {
    const week = WEEKS.find((w) => w.id === '2014-10-20')!;
    const input = playWeek(week, 5);
    const all = [...QUIZ.nights.flatMap((n) => nightQuiz(input, n)), ...debriefQuiz(input)];
    const flare = all.find((q) => q.template === 'flare');
    expect(flare, all.map((q) => q.template).join()).toBeDefined();
    expect(flare!.answer).toBe('calm');
  });

  it('the reducer keeps the card answer for the quiz', () => {
    const week = first();
    let m: Model = reducer(initialModel, { type: 'START', week, seed: 1, firstMission: true });
    const go = (a: Parameters<typeof reducer>[1]) => (m = reducer(m, a));
    go({ type: 'NEXT' }); // day 1 morning → plan
    go({ type: 'SET', k: 'ls' }); go({ type: 'SET', k: 'ls' });
    go({ type: 'CONFIRM' }); go({ type: 'NEXT' }); go({ type: 'NEXT' }); go({ type: 'NEXT' }); // run → night → morning → plan
    go({ type: 'CHOOSE', card: 'shadow:heat' });
    go({ type: 'CONFIRM' });
    expect(m.picks).toEqual({ 2: 'shadow:heat' });
  });
});
