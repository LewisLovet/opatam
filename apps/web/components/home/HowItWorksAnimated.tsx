'use client';

/**
 * HowItWorksAnimated — replaces the static "3 étapes" block with an
 * auto-cycling sequence. The visual model:
 *
 *   1. The section enters the viewport → the 3 step cards stagger-in
 *      (fade + slide up) so the user perceives motion immediately.
 *   2. Once visible, an auto-cycle highlights step 1, then 2, then 3,
 *      then loops. The active card scales up slightly and gets a
 *      primary-tinted icon block; the connector line fills from left
 *      to right to track progress.
 *   3. Honors `prefers-reduced-motion`: in that mode the cycling is
 *      disabled (all 3 cards rendered static) and the entrance is
 *      instantaneous.
 *
 * Kept dependency-free (no Framer Motion) — pure Tailwind transitions
 * driven by React state.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { UserPlus, Globe, CalendarCheck } from 'lucide-react';
import { APP_CONFIG } from '@booking-app/shared';

// Text lives in packages/i18n (home.howItWorks); only icons stay in code.
const STEP_ICONS = [UserPlus, Globe, CalendarCheck];

const CYCLE_INTERVAL_MS = 3500;

export function HowItWorksAnimated() {
  const t = useTranslations('home.howItWorks');
  const stepTexts = t.raw('steps') as { title: string; description: string }[];
  const STEPS = stepTexts.map((text, i) => ({ ...text, icon: STEP_ICONS[i] }));

  const sectionRef = useRef<HTMLElement>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [active, setActive] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Detect prefers-reduced-motion once on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Trigger entrance + cycling once the section enters the viewport.
  useEffect(() => {
    if (!sectionRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasEntered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Auto-cycle the highlighted step. Respects reduced motion: stops
  // the timer entirely so the section reads as a plain list.
  useEffect(() => {
    if (!hasEntered || reducedMotion) return;
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % STEPS.length);
    }, CYCLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasEntered, reducedMotion]);

  // Progress line fill — 0%, 50%, 100% for steps 0, 1, 2 respectively.
  // In reduced-motion mode we leave it fully filled so the visual
  // doesn't feel stuck on step 0.
  const progress = reducedMotion ? 100 : (active / (STEPS.length - 1)) * 100;

  return (
    <section
      ref={sectionRef}
      className="py-16 sm:py-24 bg-gray-50 dark:bg-gray-800"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            {t('subtitle')}
          </p>
        </div>

        <div className="relative">
          {/* Animated connector line — sits behind the icon row. The
              visible track is grey; the primary fill widens to track
              the active step. Hidden on mobile where columns stack. */}
          <div className="hidden md:block absolute top-10 left-[16.66%] right-[16.66%] h-0.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-primary-500 rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              // In reduced-motion mode every step is "active" so the
              // section stays informative without any animation.
              const isActive = reducedMotion ? true : active === index;
              return (
                <div
                  key={step.title}
                  className="relative text-center transition-all duration-500 ease-out"
                  style={{
                    opacity: hasEntered || reducedMotion ? 1 : 0,
                    transform:
                      hasEntered || reducedMotion
                        ? 'translateY(0)'
                        : 'translateY(16px)',
                    transitionDelay: reducedMotion
                      ? '0ms'
                      : `${index * 150}ms`,
                  }}
                >
                  <div
                    className={`
                      relative inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6
                      transition-all duration-500
                      ${isActive
                        ? 'bg-primary-600 text-white shadow-xl shadow-primary-500/30 scale-110'
                        : 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                      }
                    `}
                  >
                    <Icon className="w-10 h-10" />
                    <span
                      className={`
                        absolute -top-2 -right-2 w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center
                        transition-all duration-300
                        ${isActive
                          ? 'bg-white text-primary-600 ring-4 ring-primary-200 dark:ring-primary-900'
                          : 'bg-primary-600 text-white'
                        }
                      `}
                    >
                      {index + 1}
                    </span>
                  </div>
                  <h3
                    className={`
                      text-xl font-semibold mb-3 transition-colors duration-300
                      ${isActive
                        ? 'text-primary-700 dark:text-primary-300'
                        : 'text-gray-900 dark:text-white'
                      }
                    `}
                  >
                    {step.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 max-w-xs mx-auto">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center bg-primary-600 text-white hover:bg-primary-700 px-8 py-4 text-lg font-semibold rounded-lg transition-colors"
          >
            {t('cta')}
          </Link>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
            {t('note', { days: APP_CONFIG.trialDays })}
          </p>
        </div>
      </div>
    </section>
  );
}
