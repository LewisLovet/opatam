'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import {
  PartyPopper,
  Sparkles,
  Users,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubscriptionSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string; // 'Pro' or 'Studio'
  planFeatures: string[];
}

// ---------------------------------------------------------------------------
// Confetti particle configuration
// ---------------------------------------------------------------------------

interface ConfettiParticle {
  id: number;
  left: number; // percent from left
  size: number; // px
  color: string;
  delay: number; // seconds
  duration: number; // seconds
  shape: 'circle' | 'square' | 'rectangle';
  rotateEnd: number; // degrees
  swayAmount: number; // px horizontal sway
  opacity: number;
}

const CONFETTI_COLORS = [
  '#3b82f6', // blue-500
  '#2563eb', // blue-600
  '#6366f1', // indigo-500
  '#4f46e5', // indigo-600
  '#8b5cf6', // violet-500
  '#f59e0b', // amber-500
  '#d97706', // amber-600
  '#fbbf24', // amber-400
  '#10b981', // emerald-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#a855f7', // purple-500
];

function generateParticles(count: number): ConfettiParticle[] {
  const particles: ConfettiParticle[] = [];
  for (let i = 0; i < count; i++) {
    const shapes: ConfettiParticle['shape'][] = [
      'circle',
      'square',
      'rectangle',
    ];
    particles.push({
      id: i,
      left: Math.random() * 100,
      size: 4 + Math.random() * 8,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: Math.random() * 2.5,
      duration: 2.5 + Math.random() * 3,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      rotateEnd: 360 + Math.random() * 720,
      swayAmount: -30 + Math.random() * 60,
      opacity: 0.7 + Math.random() * 0.3,
    });
  }
  return particles;
}

// ---------------------------------------------------------------------------
// Sparkle burst configuration (small sparkles near the icon)
// ---------------------------------------------------------------------------

interface SparklePoint {
  id: number;
  angle: number; // degrees
  distance: number; // px
  size: number; // px
  delay: number; // seconds
  color: string;
}

function generateSparkles(count: number): SparklePoint[] {
  const sparkles: SparklePoint[] = [];
  const sparkleColors = ['#fbbf24', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ffffff'];
  for (let i = 0; i < count; i++) {
    sparkles.push({
      id: i,
      angle: (360 / count) * i + (Math.random() * 20 - 10),
      distance: 40 + Math.random() * 35,
      size: 3 + Math.random() * 4,
      delay: 0.3 + Math.random() * 0.6,
      color: sparkleColors[Math.floor(Math.random() * sparkleColors.length)],
    });
  }
  return sparkles;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PARTICLES = generateParticles(28);
const SPARKLES = generateSparkles(12);

export function SubscriptionSuccessModal({
  isOpen,
  onClose,
  planName,
  planFeatures,
}: SubscriptionSuccessModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [featuresRevealed, setFeaturesRevealed] = useState(0);
  const [showCta, setShowCta] = useState(false);
  const [mounted, setMounted] = useState(false);
  const featureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine icons based on plan
  const isPro = planName === 'Pro';
  const PlanIcon = isPro ? Sparkles : Users;

  // ---------- Lifecycle ----------

  // Client mount guard for createPortal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Open sequence: stagger features, then show CTA
  useEffect(() => {
    if (isOpen) {
      // Small delay to let the portal mount before triggering CSS transitions
      const openTimer = setTimeout(() => setIsVisible(true), 30);

      // Stagger feature reveals
      let revealed = 0;
      const revealNext = () => {
        revealed += 1;
        setFeaturesRevealed(revealed);
        if (revealed < planFeatures.length) {
          featureTimerRef.current = setTimeout(revealNext, 120);
        }
      };
      // Start revealing after the card has animated in
      featureTimerRef.current = setTimeout(revealNext, 800);

      // Show CTA after all features have appeared
      const ctaDelay = 800 + planFeatures.length * 120 + 300;
      ctaTimerRef.current = setTimeout(() => setShowCta(true), ctaDelay);

      // Clean URL params (remove success=true)
      cleanUrlParams();

      return () => {
        clearTimeout(openTimer);
        if (featureTimerRef.current) clearTimeout(featureTimerRef.current);
        if (ctaTimerRef.current) clearTimeout(ctaTimerRef.current);
      };
    } else {
      // Reset state when closed
      setIsVisible(false);
      setIsClosing(false);
      setFeaturesRevealed(0);
      setShowCta(false);
    }
  }, [isOpen, planFeatures.length]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // ---------- Handlers ----------

  const cleanUrlParams = useCallback(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // Silently fail in SSR or edge cases
    }
  }, []);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    // Wait for the exit animation to complete before unmounting
    setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
      onClose();
    }, 400);
  }, [onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, handleClose]);

  // ---------- Render guard ----------

  if (!isOpen || !mounted) return null;

  // ---------- Styles ----------

  const overlayStyle: CSSProperties = {
    opacity: isVisible && !isClosing ? 1 : 0,
    transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  };

  const cardStyle: CSSProperties = {
    opacity: isVisible && !isClosing ? 1 : 0,
    transform:
      isVisible && !isClosing
        ? 'translateY(0) scale(1)'
        : isClosing
          ? 'translateY(24px) scale(0.95)'
          : 'translateY(40px) scale(0.95)',
    transition:
      'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
  };

  // ---------- JSX ----------

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Bienvenue dans le plan ${planName}`}
    >
      {/* ----- Backdrop ----- */}
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
        style={overlayStyle}
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* ----- CSS-only confetti particles ----- */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={overlayStyle}
        aria-hidden="true"
      >
        {PARTICLES.map((p) => {
          const borderRadius =
            p.shape === 'circle'
              ? '50%'
              : p.shape === 'square'
                ? '2px'
                : '1px';
          const width = p.shape === 'rectangle' ? p.size * 0.5 : p.size;
          const height = p.shape === 'rectangle' ? p.size * 1.6 : p.size;

          return (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: `${p.left}%`,
                top: '-20px',
                width: `${width}px`,
                height: `${height}px`,
                backgroundColor: p.color,
                borderRadius,
                opacity: 0,
                animation:
                  isVisible && !isClosing
                    ? `confetti-fall ${p.duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${p.delay}s both`
                    : 'none',
                // CSS custom properties for per-particle variation
                ['--sway' as string]: `${p.swayAmount}px`,
                ['--rotate-end' as string]: `${p.rotateEnd}deg`,
                ['--particle-opacity' as string]: p.opacity,
              }}
            />
          );
        })}
      </div>

      {/* ----- Modal card ----- */}
      <div
        className="relative z-10 w-full max-w-md"
        style={cardStyle}
      >
        {/* Glow effect behind card */}
        <div
          className="absolute -inset-1 rounded-2xl opacity-40 blur-xl"
          style={{
            background: isPro
              ? 'linear-gradient(135deg, #3b82f6, #6366f1, #3b82f6)'
              : 'linear-gradient(135deg, #8b5cf6, #a855f7, #8b5cf6)',
            animation: isVisible ? 'glow-pulse 3s ease-in-out infinite' : 'none',
          }}
          aria-hidden="true"
        />

        {/* Card body */}
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Top gradient stripe */}
          <div
            className="h-1.5 w-full"
            style={{
              background: isPro
                ? 'linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)'
                : 'linear-gradient(90deg, #8b5cf6, #a855f7, #d946ef)',
            }}
          />

          {/* Content */}
          <div className="px-6 pt-8 pb-6 text-center">
            {/* ----- Icon with sparkle burst ----- */}
            <div className="relative inline-flex items-center justify-center mb-5">
              {/* Sparkle burst particles */}
              {SPARKLES.map((s) => {
                const rad = (s.angle * Math.PI) / 180;
                const x = Math.cos(rad) * s.distance;
                const y = Math.sin(rad) * s.distance;
                return (
                  <div
                    key={s.id}
                    style={{
                      position: 'absolute',
                      width: `${s.size}px`,
                      height: `${s.size}px`,
                      borderRadius: '50%',
                      backgroundColor: s.color,
                      opacity: 0,
                      animation:
                        isVisible && !isClosing
                          ? `sparkle-burst 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${s.delay}s both`
                          : 'none',
                      ['--sparkle-x' as string]: `${x}px`,
                      ['--sparkle-y' as string]: `${y}px`,
                    }}
                  />
                );
              })}

              {/* Icon circle background */}
              <div
                className="relative flex items-center justify-center w-20 h-20 rounded-full"
                style={{
                  background: isPro
                    ? 'linear-gradient(135deg, #eff6ff, #e0e7ff)'
                    : 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
                  animation: isVisible ? 'icon-entrance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both' : 'none',
                }}
              >
                {/* Party popper (background, slight offset) */}
                <PartyPopper
                  className="absolute w-6 h-6 -top-1 -right-1"
                  style={{
                    color: '#f59e0b',
                    animation: isVisible ? 'icon-entrance 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s both' : 'none',
                  }}
                />

                {/* Main plan icon */}
                <PlanIcon
                  className="w-10 h-10"
                  style={{
                    color: isPro ? '#4f46e5' : '#7c3aed',
                  }}
                />
              </div>
            </div>

            {/* ----- Headline ----- */}
            <div
              style={{
                opacity: 0,
                animation: isVisible && !isClosing
                  ? 'fade-in-up-custom 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.35s both'
                  : 'none',
              }}
            >
              <h2 className="text-2xl sm:text-[1.65rem] font-extrabold leading-tight mb-2">
                <span className="text-gray-900 dark:text-white">
                  Bienvenue dans le plan{' '}
                </span>
                <span
                  style={{
                    background: isPro
                      ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                      : 'linear-gradient(135deg, #8b5cf6, #a855f7)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {planName}
                </span>
                <span className="text-gray-900 dark:text-white">{'\u00A0'}!</span>
              </h2>
            </div>

            {/* ----- Plan tier badge ----- */}
            <div
              style={{
                opacity: 0,
                animation: isVisible && !isClosing
                  ? 'fade-in-up-custom 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.42s both'
                  : 'none',
              }}
            >
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wider text-white mb-3"
                style={{
                  background: isPro
                    ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                    : 'linear-gradient(135deg, #8b5cf6, #a855f7)',
                }}
              >
                {isPro ? 'IND\u00c9PENDANT' : '\u00c9QUIPE'}
              </span>
            </div>

            {/* ----- Subtitle ----- */}
            <p
              className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs mx-auto leading-relaxed"
              style={{
                opacity: 0,
                animation: isVisible && !isClosing
                  ? 'fade-in-up-custom 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.5s both'
                  : 'none',
              }}
            >
              {isPro
                ? 'Votre activit\u00e9 passe au niveau sup\u00e9rieur. D\u00e9couvrez tout ce qui est maintenant disponible.'
                : 'Votre \u00e9quipe est pr\u00eate \u00e0 collaborer. G\u00e9rez plusieurs agendas et lieux en toute simplicit\u00e9.'}
            </p>

            {/* ----- Highlight card ----- */}
            <div
              className="rounded-lg px-4 py-3 mb-5 text-center"
              style={{
                background: isPro
                  ? 'linear-gradient(135deg, #eff6ff, #e0e7ff)'
                  : 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
                border: isPro
                  ? '1px solid #bfdbfe'
                  : '1px solid #c4b5fd',
                opacity: 0,
                animation: isVisible && !isClosing
                  ? 'fade-in-up-custom 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.58s both'
                  : 'none',
              }}
            >
              <p
                className="text-sm font-semibold m-0"
                style={{
                  color: isPro ? '#4338ca' : '#6d28d9',
                }}
              >
                {isPro
                  ? '1 agenda \u2022 1 lieu \u2022 0\u00A0% commission'
                  : 'Jusqu\u2019\u00e0 5 agendas \u2022 5 lieux \u2022 0\u00A0% commission'}
              </p>
            </div>

            {/* ----- Feature checklist ----- */}
            <div className="text-left mb-6">
              <ul className="space-y-2.5">
                {planFeatures.map((feature, index) => {
                  const isRevealed = index < featuresRevealed;
                  return (
                    <li
                      key={index}
                      className="flex items-start gap-2.5"
                      style={{
                        opacity: isRevealed ? 1 : 0,
                        transform: isRevealed
                          ? 'translateX(0)'
                          : 'translateX(-12px)',
                        transition:
                          'opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      <span
                        className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 mt-0.5"
                        style={{
                          background: isPro
                            ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                            : 'linear-gradient(135deg, #8b5cf6, #a855f7)',
                          transform: isRevealed ? 'scale(1)' : 'scale(0)',
                          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                          transitionDelay: '0.05s',
                        }}
                      >
                        <CheckCircle2
                          className="w-3.5 h-3.5 text-white"
                          strokeWidth={2.5}
                        />
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 leading-snug">
                        {feature}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* ----- CTA button ----- */}
            <div
              style={{
                opacity: showCta ? 1 : 0,
                transform: showCta ? 'translateY(0)' : 'translateY(12px)',
                transition:
                  'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <button
                type="button"
                onClick={handleClose}
                className="
                  group w-full inline-flex items-center justify-center gap-2.5
                  px-6 py-3 rounded-xl text-sm font-semibold text-white
                  shadow-lg hover:shadow-xl
                  transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                "
                style={{
                  background: isPro
                    ? 'linear-gradient(135deg, #3b82f6, #4f46e5)'
                    : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                }}
              >
                {`C'est parti, d\u00e9couvrir mon espace`}
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ----- Inline keyframes (global, idempotent via id) ----- */}
      <style
        id="subscription-success-keyframes"
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes confetti-fall {
              0% {
                opacity: var(--particle-opacity, 0.8);
                transform: translateY(0) translateX(0) rotate(0deg);
              }
              25% {
                opacity: var(--particle-opacity, 0.8);
              }
              100% {
                opacity: 0;
                transform: translateY(100vh) translateX(var(--sway, 0px))
                  rotate(var(--rotate-end, 720deg));
              }
            }

            @keyframes sparkle-burst {
              0% {
                opacity: 0;
                transform: translate(0, 0) scale(0);
              }
              50% {
                opacity: 1;
                transform: translate(
                    calc(var(--sparkle-x, 0px) * 0.6),
                    calc(var(--sparkle-y, 0px) * 0.6)
                  )
                  scale(1.2);
              }
              100% {
                opacity: 0;
                transform: translate(var(--sparkle-x, 0px), var(--sparkle-y, 0px))
                  scale(0);
              }
            }

            @keyframes icon-entrance {
              0% {
                opacity: 0;
                transform: scale(0.3) rotate(-15deg);
              }
              100% {
                opacity: 1;
                transform: scale(1) rotate(0deg);
              }
            }

            @keyframes fade-in-up-custom {
              0% {
                opacity: 0;
                transform: translateY(16px);
              }
              100% {
                opacity: 1;
                transform: translateY(0);
              }
            }

            @keyframes glow-pulse {
              0%, 100% {
                opacity: 0.3;
                transform: scale(1);
              }
              50% {
                opacity: 0.5;
                transform: scale(1.03);
              }
            }
          `,
        }}
      />
    </div>
  );

  return createPortal(content, document.body);
}
