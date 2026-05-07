'use client';

/**
 * HeroVideo — autoplay-loop video panel for the landing-page Hero.
 *
 * Performance trade-offs and decisions:
 *
 *  - First paint is a branded loader (Opatam logomark + wordmark on a
 *    dark gradient) rather than a video frame. That keeps the LCP
 *    instant (it's just CSS + tiny inline content), feels intentional
 *    while the user waits, and avoids the "is the video broken?"
 *    feeling a black rectangle gives.
 *  - `preload="metadata"` lets the browser fetch only the minimum
 *    needed to start playback. The video downloads in parallel with
 *    the rest of the page, not blocking the initial render.
 *  - `muted playsInline autoPlay loop` is the canonical combo that
 *    works on iOS Safari without user interaction.
 *  - `prefers-reduced-motion`: the loader stays as the final frame —
 *    no video plays. Respects accessibility and saves bandwidth for
 *    users who opt out of motion.
 *  - Once the first frame is decoded (`onCanPlay`) we fade the loader
 *    OUT (over the playing video) for a smooth handoff.
 */

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { APP_CONFIG } from '@booking-app/shared/constants';

interface HeroVideoProps {
  /**
   * Layout mode:
   *  - `panel` (default): bordered card with shadow, sits in a column.
   *  - `background`: fills the parent absolutely, no border/shadow —
   *    used as the cinematic hero backdrop with text overlay.
   */
  variant?: 'panel' | 'background';
}

/**
 * Branded splash shown until the video's first frame decodes.
 * Designed to feel like a deliberate brand frame — not a spinner.
 *
 *  - Dark gradient base + a slow drifting primary-tinted radial
 *    glow give ambient motion without the "loading spinner" feel.
 *  - The real Opatam logo (served from /public/logo-opatam.png) is
 *    centered and "breathes" gently (1.0 → 1.04 → 1.0 over 6s).
 *  - The wordmark in widely-tracked uppercase reads as a movie-
 *    title plate.
 *  - No spinner, no progress bar, no percentage. The frame stands
 *    on its own — if the video loads in 200ms (likely cache hit),
 *    the user sees a clean handoff; if it takes 2-3s, the splash
 *    looks intentional, like a brand intro.
 */
function HeroVideoLoader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-gradient-to-br from-gray-950 via-[#0b0b1a] to-gray-950">
      {/* Slow-drifting primary glow — provides ambient motion to the
          frame so it doesn't feel frozen. Sits behind the logo. */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] animate-splash-glow"
        style={{
          background:
            'radial-gradient(circle at center, rgba(124,58,237,0.28) 0%, rgba(124,58,237,0.10) 35%, transparent 65%)',
          filter: 'blur(60px)',
        }}
      />
      {/* Faint top vignette for depth */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/30"
      />

      <div className="relative flex flex-col items-center gap-5 animate-splash-fade-in">
        {/* Real Opatam logo — local /public asset so first paint is
            instant. Soft "breathing" scale keeps the frame alive. */}
        <div className="animate-splash-breathe">
          <Image
            src="/logo-opatam.png"
            alt={APP_CONFIG.name}
            width={120}
            height={120}
            priority
            className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-[0_8px_24px_rgba(124,58,237,0.45)]"
          />
        </div>

        {/* Wordmark — generous tracking, uppercase, like a title card. */}
        <span className="text-white text-sm sm:text-base font-semibold tracking-[0.4em] uppercase">
          {APP_CONFIG.name}
        </span>

        {/* Tagline — gives the frame purpose beyond "we're loading". */}
        <span className="text-white/60 text-xs sm:text-sm font-light tracking-wide max-w-xs text-center px-6">
          La réservation en ligne, sans commission
        </span>
      </div>
    </div>
  );
}

export function HeroVideo({ variant = 'panel' }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  // Detect prefers-reduced-motion at mount + react to OS changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (variant === 'background') {
    // Full-bleed: parent controls sizing (e.g. `h-[72vh]`). We paint
    // the loader, then the video on top once it's ready.
    return (
      <>
        {/* Branded loader sits underneath. Stays in place; the video
            fades IN above it so the handoff is seamless. */}
        <HeroVideoLoader />

        {!reducedMotion && (
          <video
            ref={videoRef}
            src="/hero-loop.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onCanPlay={() => setVideoReady(true)}
            aria-hidden="true"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
              reducedMotion ? '' : 'animate-hero-video-zoom'
            } ${videoReady ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
      </>
    );
  }

  // Default panel variant — card with shadow + floating animation.
  return (
    <div className="relative mx-auto max-w-lg animate-float">
      <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700 aspect-video bg-gray-900 hover:shadow-3xl transition-shadow duration-500">
        <HeroVideoLoader />

        {!reducedMotion && (
          <video
            ref={videoRef}
            src="/hero-loop.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onCanPlay={() => setVideoReady(true)}
            aria-hidden="true"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
              reducedMotion ? '' : 'animate-hero-video-zoom'
            } ${videoReady ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
      </div>
    </div>
  );
}
