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
export type Lang = 'en' | 'uz' | 'ru';

const files = import.meta.glob<{ default: Record<string, string> }>('./*/*.json', { eager: true });

const DICTS: Record<Lang, Record<string, string>> = { en: {}, uz: {}, ru: {} };
for (const [path, mod] of Object.entries(files)) {
  const lang = path.split('/')[1] as Lang;
  if (lang in DICTS) Object.assign(DICTS[lang], mod.default);
}

export function t(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  const raw = DICTS[lang][key] || DICTS.en[key] || key;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
}
