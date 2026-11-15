import { useEffect, useRef, useState } from 'react';
import { SkipForward, Volume2, VolumeX } from 'lucide-react';
import { Btn, type Tr } from '../play/kit';

const base = import.meta.env.BASE_URL;

/**
 * The team's intro film on entering the site (Shoxjahon aka, 15 Nov ~15:40; features.introVideo): 36 s, AI-made
 * (public/video/intro.mp4, the "AI-generated" mark burned into its corner — Space Apps rule for AI video; CREDITS.md,
 * docs/AI-USE.md). It ends where the game begins: the wreck, "IMPACT · SIGNAL LOST". It starts muted (browsers allow
 * only muted autoplay), with Sound and Skip always on screen; it ends by itself, by Skip, Esc or Enter, and quietly
 * gives way if the file cannot load (offline, a slow link: nothing must stand between a child and the game).
 * The 3D base loads behind it, so the reception desk is ready when it ends. Nothing is stored.
 */
export function IntroVideo({ tr, onDone }: { tr: Tr; onDone: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    video.current?.pause();
    onDone();
  };

  useEffect(() => {
    const v = video.current;
    // muted autoplay is allowed everywhere; if a browser still refuses, the film gives way
    v?.play().catch(() => finish());
    // a film that has not started after 8 s (no network) is not waited for
    const stall = window.setTimeout(() => {
      if (v && v.currentTime === 0) finish();
    }, 8000);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(stall);
      window.removeEventListener('keydown', key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black" data-testid="intro-video">
      <video
        ref={video}
        className="h-full w-full object-contain"
        src={`${base}video/intro.mp4`}
        poster={`${base}video/intro-poster.webp`}
        muted={muted}
        autoPlay
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
        aria-label={tr('ui.intro.label')}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Btn
          className="pointer-events-auto min-h-12 px-4 text-sm"
          onClick={() => {
            const v = video.current;
            setMuted((m) => !m);
            if (v) v.muted = !muted;
          }}
          aria-pressed={!muted}
          data-testid="intro-sound"
        >
          <span className="flex items-center gap-2">
            {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
            {tr(muted ? 'ui.intro.soundOn' : 'ui.intro.soundOff')}
          </span>
        </Btn>
        <Btn className="primary pointer-events-auto min-h-12 px-5 text-base" onClick={finish} data-testid="intro-skip">
          <span className="flex items-center gap-2">
            {tr('ui.intro.skip')}
            <SkipForward size={18} aria-hidden="true" />
          </span>
        </Btn>
      </div>
    </div>
  );
}
