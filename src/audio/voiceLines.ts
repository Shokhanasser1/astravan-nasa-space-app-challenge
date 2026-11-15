/**
 * Recorded radio voices (15 Nov): which lines are voiced, who speaks each, and a fingerprint of the text, shared by
 * the game (src/audio/voice.ts) and the generator (scripts/audio/gemini-voices.mts). A file is played only when its
 * fingerprint matches the line's current text — an edited line falls back to the device's voice until it is made
 * again. No imports: Node runs this file directly.
 */
export type Speaker = 'houston' | 'pilot' | 'scout' | 'family';

/** The spoken lines: radio calls, Houston's hints, day cards, the start brief and the Day 1 tutorial lines. */
export function isVoiced(key: string): boolean {
  return (
    /^story\.(radio|houston)\./.test(key) ||
    /^story\.card\.[a-z]+\.text$/.test(key) ||
    /^ui\.tut\.[A-Za-z]+\.say$/.test(key) ||
    key === 'ui.start.brief'
  );
}

/** "Houston: …" in any of our languages → the speaker, and the words without the name (the name is not read out). */
const NAMES: [RegExp, Speaker][] = [
  [/^(houston|хьюстон|xyuston)\s*:\s*/i, 'houston'],
  [/^(pilot|пилот|uchuvchi)\s*:\s*/i, 'pilot'],
  [/^(scout|разведчик|tadqiqotchi)\s*:\s*/i, 'scout'],
  [/^(zuhra|зухра|buvi|буви|buvim|бабушка|grandma)\s*:\s*/i, 'family'],
];
export function speakerOf(text: string): { speaker: Speaker; words: string } {
  for (const [re, speaker] of NAMES) if (re.test(text)) return { speaker, words: text.replace(re, '') };
  return { speaker: 'houston', words: text };
}

/** FNV-1a, 32 bit, as 8 hex digits: enough to notice that a line was edited. */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** File name of a line: the key in lower case (asset names are lower case, scripts/check.mjs). */
export const voiceFile = (lang: string, key: string) => `audio/voice/${lang}/${key.toLowerCase()}.mp3`;
