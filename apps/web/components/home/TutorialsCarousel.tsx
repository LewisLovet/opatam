'use client';

/**
 * Auto-advancing mobile carousel for the homepage tutorials block.
 *
 * Rendered alongside (not instead of) the desktop grid — Tailwind
 * `sm:hidden` hides this on tablet+ so the existing 2/3-col grid
 * keeps its desktop layout untouched. We get a mobile-specific
 * affordance without forking the entire section.
 *
 * Behaviour:
 *  - Horizontal scroll-snap (CSS), one card per viewport
 *  - Auto-advance every 4 s
 *  - Pause-on-interaction: when the user touches / scrolls the
 *    track, the auto-advance halts and resumes 6 s after they
 *    stop interacting. Lets the visitor explore at their own pace
 *    without the carousel fighting them.
 *  - Dots indicator that mirrors the current index AND is tappable
 *    to jump to a specific card
 *  - Honours `prefers-reduced-motion`: visitors who opted out of
 *    animations get a static first card with manual swipe only,
 *    no auto-advance. Same intent as the rest of the landing.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArticleCard,
  type ArticleCardData,
} from '@/app/blog/components/ArticleCard';

interface Props {
  tutorials: ArticleCardData[];
}

const ADVANCE_INTERVAL_MS = 4000;
const RESUME_AFTER_INTERACTION_MS = 6000;

export function TutorialsCarousel({ tutorials }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // `paused` is bumped to a fresh timestamp on every interaction;
  // the auto-advance effect reads it and skips the tick while
  // recent. Avoids a stale-closure trap with a plain boolean.
  const [pausedUntil, setPausedUntil] = useState<number>(0);

  // Detect `prefers-reduced-motion`. We honour it by disabling
  // the auto-advance entirely — visitors who asked for less
  // motion don't want a self-scrolling section.
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  /** Scroll the track to a specific card index. Uses smooth scroll
   *  unless reduced-motion is on. */
  const scrollToIndex = (idx: number) => {
    const track = trackRef.current;
    if (!track) return;
    const cards = track.querySelectorAll<HTMLDivElement>('[data-carousel-card]');
    const target = cards[idx];
    if (!target) return;
    track.scrollTo({
      left: target.offsetLeft,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  // Auto-advance loop. Re-fires every ADVANCE_INTERVAL_MS unless
  // paused. The pause check is "is `pausedUntil` in the future"
  // rather than a boolean, so the effect doesn't have to be
  // explicitly woken on resume.
  useEffect(() => {
    if (prefersReducedMotion) return;
    if (tutorials.length <= 1) return;

    const id = window.setInterval(() => {
      if (Date.now() < pausedUntil) return;
      setActiveIndex((current) => {
        const next = (current + 1) % tutorials.length;
        scrollToIndex(next);
        return next;
      });
    }, ADVANCE_INTERVAL_MS);

    return () => window.clearInterval(id);
    // `scrollToIndex` is captured fresh each render but stable
    // enough — re-binding the interval on every state change
    // would churn the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorials.length, pausedUntil, prefersReducedMotion]);

  /** Push the pause window forward — called on touch / manual scroll. */
  const bumpPause = () => {
    setPausedUntil(Date.now() + RESUME_AFTER_INTERACTION_MS);
  };

  /** Keep the active dot in sync with manual scrolling. We snap on
   *  the closest card by horizontal offset. */
  const onTrackScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const cards = track.querySelectorAll<HTMLDivElement>('[data-carousel-card]');
    let closest = 0;
    let minDelta = Infinity;
    cards.forEach((card, i) => {
      const delta = Math.abs(card.offsetLeft - track.scrollLeft);
      if (delta < minDelta) {
        minDelta = delta;
        closest = i;
      }
    });
    if (closest !== activeIndex) setActiveIndex(closest);
  };

  if (tutorials.length === 0) return null;

  return (
    <div className="sm:hidden">
      {/* Horizontal scroll track. `overscroll-x-contain` keeps the
          page from bouncing horizontally when the user swipes past
          the last card on iOS. */}
      <div
        ref={trackRef}
        onScroll={onTrackScroll}
        onTouchStart={bumpPause}
        onPointerDown={bumpPause}
        className="-mx-4 flex overflow-x-auto snap-x snap-mandatory scroll-smooth overscroll-x-contain px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tutorials.map((t) => (
          <div
            key={t.slug}
            data-carousel-card
            className="snap-center shrink-0 basis-full pr-4 last:pr-0"
          >
            <ArticleCard article={t} />
          </div>
        ))}
      </div>

      {/* Dots indicator. Tap to jump, keyboard-accessible via
          `<button>`. `aria-current` flags the active one for AT. */}
      <div
        className="mt-6 flex items-center justify-center gap-2"
        role="tablist"
        aria-label="Sélection du tutoriel"
      >
        {tutorials.map((t, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={t.slug}
              type="button"
              role="tab"
              aria-current={active ? 'true' : undefined}
              aria-label={`Tutoriel ${i + 1} sur ${tutorials.length}`}
              onClick={() => {
                bumpPause();
                setActiveIndex(i);
                scrollToIndex(i);
              }}
              className={
                active
                  ? 'h-2 w-6 rounded-full bg-primary-600 dark:bg-primary-400 transition-all'
                  : 'h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600 transition-all'
              }
            />
          );
        })}
      </div>
    </div>
  );
}
