import en from './en.json';
import uz from './uz.json';
import ru from './ru.json';
import { useGame, type Lang } from '../state/store';

/**
 * All player-facing text lives in en/uz/ru.json and is written by the team, not generated.
 * Code references keys only. English opens by default; Uzbek and Russian are one button away.
 * Uzbek oʻ/gʻ use U+02BB; `npm run check` verifies it.
 */
type Dict = Record<string, string>;
const DICTS: Record<Lang, Dict> = { en, uz, ru };

export function translate(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  const raw = DICTS[lang][key] || DICTS.en[key] || key;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
}

export function useT() {
  const lang = useGame((s) => s.settings.lang);
  return (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
}
