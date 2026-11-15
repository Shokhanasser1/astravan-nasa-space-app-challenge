import { describe, expect, it } from 'vitest';
import { fingerprint, isVoiced, speakerOf, voiceFile } from './voiceLines';

describe('voiced radio lines', () => {
  it('voices radio calls, hints, card texts, the brief and the tutorial, not button labels', () => {
    expect(isVoiced('story.radio.day1')).toBe(true);
    expect(isVoiced('story.houston.storm')).toBe(true);
    expect(isVoiced('story.card.dust.text')).toBe(true);
    expect(isVoiced('story.card.dust.brush')).toBe(false);
    expect(isVoiced('ui.tut.walkHub.say')).toBe(true);
    expect(isVoiced('ui.start.brief')).toBe(true);
    expect(isVoiced('ui.board.confirmDay')).toBe(false);
  });

  it('finds the speaker in each language and drops the name from the words', () => {
    expect(speakerOf('Houston: Welcome!')).toEqual({ speaker: 'houston', words: 'Welcome!' });
    expect(speakerOf('Пилот: Резервный бак.')).toEqual({ speaker: 'pilot', words: 'Резервный бак.' });
    expect(speakerOf('Tadqiqotchi: Radiatsiya oshdi!').speaker).toBe('scout');
    expect(speakerOf('Zuhra: Hi from home!').speaker).toBe('family');
    expect(speakerOf('Walk to the hub.')).toEqual({ speaker: 'houston', words: 'Walk to the hub.' });
  });

  it('notices an edited line and names files in lower case', () => {
    expect(fingerprint('Houston: Welcome!')).toMatch(/^[0-9a-f]{8}$/);
    expect(fingerprint('Houston: Welcome!')).not.toBe(fingerprint('Houston: Welcome.'));
    expect(voiceFile('en', 'ui.tut.walkHub.say')).toBe('audio/voice/en/ui.tut.walkhub.say.mp3');
  });
});
