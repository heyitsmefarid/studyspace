import { useEffect, useRef, useState } from 'react';
import { isDarkTheme, useTheme } from '@/lib/theme';
import { prefersReducedMotion } from '@/lib/motion';
import { SPLASH_BG, SPLASH_VIDEO, markSplashPlayed, shouldPlaySplash } from './splashGate';

const session = () => { try { return window.sessionStorage; } catch { return null; } };

/**
 * The animated logo, once per browser session when the app first opens. On portrait screens the 16:9 video is
 * enlarged so the lockup fills the width (the cropped sides are empty sky). Any key, a click or "Skip intro" ends it;
 * if autoplay is refused or the video fails, it gets out of the way at once. The app renders underneath meanwhile.
 */
export function Splash() {
  const [show, setShow] = useState(() => shouldPlaySplash(session(), prefersReducedMotion()));
  const [leaving, setLeaving] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const tone = isDarkTheme(useTheme()) ? 'dark' : 'light';

  useEffect(() => {
    if (!show) return;
    markSplashPlayed(session());
    video.current?.play().catch(() => setShow(false));
    const skip = () => setLeaving(true);
    window.addEventListener('keydown', skip);
    // Never hold the app back if playback stalls: the intro is 5.5 s.
    const cap = window.setTimeout(skip, 8000);
    return () => { window.removeEventListener('keydown', skip); window.clearTimeout(cap); };
  }, [show]);

  if (!show) return null;
  return (
    <div
      aria-label="StudySpace intro"
      onClick={() => setLeaving(true)}
      onTransitionEnd={(e) => { if (leaving && e.target === e.currentTarget) setShow(false); }}
      className="fixed inset-0 z-[100] flex cursor-pointer items-center justify-center overflow-hidden transition-opacity duration-500 ease-out"
      style={{ background: SPLASH_BG[tone], opacity: leaving ? 0 : 1 }}
    >
      <video
        ref={video}
        src={SPLASH_VIDEO[tone]}
        muted
        playsInline
        preload="auto"
        aria-hidden
        onEnded={() => setLeaving(true)}
        onError={() => setShow(false)}
        className="h-full w-full shrink-0 object-contain portrait:h-auto portrait:w-[165vw] portrait:max-w-none [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)] portrait:[mask-image:linear-gradient(to_bottom,transparent,black_32%,black_68%,transparent)]"
      />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setLeaving(true); }}
        className={`absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 rounded-full px-4 py-2 text-sm font-semibold ${tone === 'dark' ? 'text-white/70 hover:text-white' : 'text-[#1B2150]/60 hover:text-[#1B2150]'}`}
      >
        Skip intro
      </button>
    </div>
  );
}
