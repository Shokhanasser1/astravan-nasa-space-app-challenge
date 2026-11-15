/**
 * Player-facing text. One file per language and lane, merged at load, so lanes never edit the same file:
 *   src/i18n/<lang>/ui.json      lane D (interface)     keys "ui.*"
 *   src/i18n/<lang>/scene.json   lane C (scene)         keys "scene.*"
 *   src/i18n/<lang>/story.json   lane F (story, radio)  keys "story.*"
 *   src/i18n/<lang>/engine.json  lane B (night log, warnings, titles)  keys "engine.*"
 *   src/i18n/<lang>/data.json    Data page and facts    keys "data.*"
 * Any lane adds keys (value "") to its own file; the WORDS are written by people (Aminjon), never generated.
 * English is the default; Uzbek and Russian one button away. Uzbek oʻ/gʻ use U+02BB (`npm run check`).
 */
import { features } from '../config/features';

export type Lang = 'en' | 'uz' | 'ru';
export type Dicts = Record<Lang, Record<string, string>>;

const files = import.meta.glob<{ default: Record<string, string> }>('./*/*.json', { eager: true });

const DICTS: Dicts = { en: {}, uz: {}, ru: {} };
for (const [path, mod] of Object.entries(files)) {
  const lang = path.split('/')[1] as Lang;
  if (lang in DICTS) Object.assign(DICTS[lang], mod.default);
}

/**
 * The home story (features.homeStory, docs/plans/2026-11-15-home-story.md) changes words without touching a call
 * site: `<key>.hs`, in the same lane file as `<key>`, is the story's version of that line, and t() reads it first
 * while the story is on. Same slots as `<key>`. Flag off → no overlay is ever read: today's game, word for word.
 *
 * Order with the story on: own-language `.hs` → English `.hs` → own-language line → English line → the key.
 * The English story line beats the old Uzbek or Russian line on purpose: an overlay exists only where the old words
 * tell the old story ("Welcome to the Moon", "Life Support", "Crew", "Confirm day"), so the old line would contradict
 * the gauges, the radio and the buttons around it. One English line in the right story is better than a translated
 * line in the wrong one. To keep that fallback rare, every English overlay is written in uz and ru too (t.test.ts).
 */
export const STORY_SUFFIX = '.hs';

let story: boolean = features.homeStory;

/** Tests only: switch the story overlay on or off; no argument → back to `features.homeStory`. */
export function setStory(on: boolean = features.homeStory): void {
  story = on;
}

/** The raw line for a key (no slots filled), in the order described above. Pure, so tests can pass their own words. */
export function lookup(dicts: Dicts, lang: Lang, key: string, withStory: boolean): string {
  const own = dicts[lang];
  const en = dicts.en;
  const hs = key + STORY_SUFFIX;
  return (withStory && (own[hs] || en[hs])) || own[key] || en[key] || key;
}

/** All merged words of one language, read-only (tests check the story overlays against their keys). */
export const words = (lang: Lang): Readonly<Record<string, string>> => DICTS[lang];

export function t(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  const raw = lookup(DICTS, lang, key, story);
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
}
