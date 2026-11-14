import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { t, type Lang } from '../../i18n/t';

/**
 * Lane D placeholder kit for the playable G2 build. Asilbek restyles or replaces these with the visor design;
 * the wiring (which action each control dispatches, which selector each number comes from) stays.
 */
export type Tr = (key: string, vars?: Record<string, string | number>) => string;
export const makeTr = (lang: Lang): Tr => (key, vars) => t(lang, key, vars);

export function Btn(props: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  const { active, className = '', ...rest } = props;
  return (
    <button
      {...rest}
      className={`min-h-12 min-w-12 rounded-xl px-3 py-2 font-semibold transition active:scale-95 disabled:opacity-40 ${
        active ? 'bg-white text-black' : 'bg-white/10 text-white'
      } ${className}`}
    />
  );
}

/** A number change shown as "4 → 3", so the price is visible before any word is written. */
export function Delta({ from, to, unit = '' }: { from: number; to: number; unit?: string }) {
  const tone = to < from ? 'text-alert' : to > from ? 'text-measured' : 'opacity-70';
  return (
    <span className={`tabular-nums ${tone}`}>
      {from}
      {unit} → {to}
      {unit}
    </span>
  );
}

export function Panel({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={`pointer-events-auto rounded-2xl bg-black/70 p-3 backdrop-blur ${className}`} />;
}
