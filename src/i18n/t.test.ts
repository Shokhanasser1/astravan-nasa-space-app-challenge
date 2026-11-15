import { afterEach, describe, expect, it } from 'vitest';
import { features } from '../config/features';
import { lookup, setStory, STORY_SUFFIX, t, words, type Dicts, type Lang } from './t';

afterEach(() => setStory());

describe('home story overlay: the order', () => {
  const dicts: Dicts = {
    en: { a: 'old a en', 'a.hs': 'story a en', b: 'old b en', 'b.hs': 'story b en', c: 'old c en' },
    uz: { a: 'old a uz', 'a.hs': 'story a uz', b: 'old b uz', c: '' },
    ru: {},
  };

  it('flag off: the old words, the overlay is never read', () => {
    expect(lookup(dicts, 'uz', 'a', false)).toBe('old a uz');
    expect(lookup(dicts, 'uz', 'b', false)).toBe('old b uz');
    expect(lookup(dicts, 'en', 'a', false)).toBe('old a en');
  });

  it('flag on: the overlay in the same language first', () => {
    expect(lookup(dicts, 'uz', 'a', true)).toBe('story a uz');
    expect(lookup(dicts, 'en', 'a', true)).toBe('story a en');
  });

  it('flag on, overlay missing in uz: the English overlay beats the old Uzbek line', () => {
    expect(lookup(dicts, 'uz', 'b', true)).toBe('story b en');
    expect(lookup(dicts, 'ru', 'a', true)).toBe('story a en');
  });

  it('no overlay anywhere: the old line, then English, then the key itself', () => {
    expect(lookup(dicts, 'uz', 'c', true)).toBe('old c en');
    expect(lookup(dicts, 'uz', 'missing', true)).toBe('missing');
  });
});

describe('t() with the real words', () => {
  it('starts from features.homeStory', () => {
    expect(t('en', 'ui.board.confirmDay')).toBe(features.homeStory ? 'Start the day' : 'Confirm day');
  });

  it('flag off → today’s game; on → the story, slots filled, keys without an overlay unchanged', () => {
    setStory(false);
    expect(t('en', 'ui.board.confirmDay')).toBe('Confirm day');
    expect(t('en', 'story.radio.day1')).toContain('Welcome to the Moon');
    setStory(true);
    expect(t('en', 'ui.board.confirmDay')).toBe('Start the day');
    expect(t('en', 'ui.night.title')).toBe('While you slept');
    expect(t('en', 'story.radio.day1')).not.toContain('Welcome');
    expect(t('uz', 'ui.machine.ls')).toBe('Havo qurilmasi');
    expect(t('ru', 'ui.machine.sc')).toBe('Ровер');
    expect(t('en', 'engine.log.found', { n: 2 })).toBe('The rover brought ship parts: 2.');
    expect(t('en', 'ui.hud.next')).toBe('Next');
  });
});

describe('the story overlays themselves', () => {
  const LANGS: Lang[] = ['en', 'uz', 'ru'];
  const slots = (s: string) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
  const overlays = (lang: Lang) => Object.keys(words(lang)).filter((k) => k.endsWith(STORY_SUFFIX));

  it('there are overlays, and each one replaces a key that exists (or it would never show)', () => {
    expect(overlays('en').length).toBeGreaterThan(40);
    for (const lang of LANGS) {
      for (const k of overlays(lang)) expect(words('en'), `${lang} ${k}`).toHaveProperty([k.slice(0, -STORY_SUFFIX.length)]);
    }
  });

  it('an overlay uses only the slots its key is given', () => {
    for (const lang of LANGS) {
      for (const k of overlays(lang)) {
        const given = slots(words('en')[k.slice(0, -STORY_SUFFIX.length)]);
        for (const s of slots(words(lang)[k])) expect(given.has(s), `${lang} ${k} {${s}}`).toBe(true);
      }
    }
  });

  it('every English overlay is written in uz and ru too (else English shows there: see the order in t.ts)', () => {
    for (const lang of ['uz', 'ru'] as const) {
      const missing = overlays('en').filter((k) => !words(lang)[k]);
      expect(missing, lang).toEqual([]);
    }
  });
});
