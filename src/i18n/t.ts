import en from './en.json';
import uz from './uz.json';
import ru from './ru.json';

/**
 * Lane F (Sarvar). All visible words come from these files: none inside models, textures or images.
 * Text is written by the team. English by default; Uzbek (and Russian) one button away.
 * Uzbek oʻ/gʻ use U+02BB; `npm run check` verifies it. A key must never show on screen in the final build.
 */
export type Lang = 'en' | 'uz' | 'ru';
const DICTS: Record<Lang, Record<string, string>> = { en, uz, ru };

export function t(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  const raw = DICTS[lang][key] || DICTS.en[key] || key;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
}
