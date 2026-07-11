'use client';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { APP_CONFIG, SUBSCRIPTION_PLANS } from '@booking-app/shared/constants';
import {
  ArrowRight,
  BadgePercent,
  BarChart3,
  Bell,
  Calendar,
  CalendarCheck,
  Camera,
  Check,
  ChevronDown,
  CreditCard,
  Dumbbell,
  Globe,
  Heart,
  Lightbulb,
  Lock,
  Mail,
  MapPin,
  QrCode,
  Quote,
  Scissors,
  Shield,
  Smartphone,
  Star,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PlayStoreWaitlistModal } from '@/components/common/PlayStoreWaitlistModal';
import { localizedPath } from '@/lib/localizedPath';
import { SocialLinks } from '@/components/common/SocialLinks';
import { TutorialsSection } from '@/components/home/TutorialsSection';
import { HowItWorksAnimated } from '@/components/home/HowItWorksAnimated';
import { HeroVideo } from '@/components/home/HeroVideo';
import { StorySection } from '@/components/home/StorySection';
import type { ArticleCardData } from '@/app/blog/components/ArticleCard';

// ─── Helpers ────────────────────────────────────────────────────────
/** Amount only (no symbol — the dictionaries place € around it), with the
 *  locale's decimal separator: 19,90 in fr / 19.90 in en. */
function formatAmount(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

// ─── Static (locale-independent) config ─────────────────────────────
// Text lives in packages/i18n (home.* namespaces); only icons, ids and
// visual config stay in code. Arrays are zipped by index with t.raw().
//
// To use a real screenshot, place the image in /public/images/features/
// and set the image path below. If image is null, the CSS mockup
// fallback is displayed instead.
const mainFeaturesConfig = [
  { icon: Calendar, mockup: 'agenda' as const, image: null as string | null },
  { icon: Globe, mockup: 'booking' as const, image: null as string | null },
  { icon: Smartphone, mockup: 'mobile' as const, image: null as string | null },
  { icon: Users, mockup: 'team' as const, image: null as string | null },
];

const secondaryFeatureIcons = [Globe, QrCode, Bell, BarChart3, MapPin, Mail, Smartphone, Shield];

const sectorIcons = [Scissors, Heart, Dumbbell, Lightbulb, Wrench, Camera];

const teamMemberColors = ['bg-primary-400', 'bg-emerald-400', 'bg-amber-400'];

// ═════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════
interface LandingPageProps {
  /** Optional list of published tutorials surfaced just above the FAQ. */
  tutorials?: ArticleCardData[];
}

export default function LandingPage({ tutorials = [] }: LandingPageProps) {
  const t = useTranslations('home');
  const locale = useLocale();

  // ── Translated data arrays (from packages/i18n dictionaries) ──────
  const faqItems = t.raw('faq.items') as { question: string; answer: string }[];
  const comparisonRows = t.raw('comparison.rows') as {
    label: string;
    opatam: string;
    others: string;
  }[];
  const testimonials = t.raw('testimonials.items') as {
    name: string;
    role: string;
    city: string;
    initials: string;
    text: string;
  }[];
  const statsItems = t.raw('stats.items') as { value: string; label: string }[];
  const featureTexts = t.raw('features.items') as { title: string; description: string }[];
  const mainFeatures = mainFeaturesConfig.map((config, i) => ({ ...config, ...featureTexts[i] }));
  const secondaryTexts = t.raw('secondaryFeatures.items') as {
    title: string;
    description: string;
  }[];
  const secondaryFeatures = secondaryTexts.map((text, i) => ({
    ...text,
    icon: secondaryFeatureIcons[i],
  }));
  const sectorTexts = t.raw('sectors.items') as { title: string; examples: string }[];
  const sectors = sectorTexts.map((text, i) => ({ ...text, icon: sectorIcons[i] }));
  const mockupDays = t.raw('mockups.days') as string[];
  const mockupServices = t.raw('mockups.services') as string[];
  const mockupTeam = t.raw('mockups.teamMembers') as { name: string; role: string; rdv: string }[];
  const mockupBookings = t.raw('mockups.sampleBookings') as {
    time: string;
    name: string;
    service: string;
  }[];
  const proFeatures = t.raw('pricing.pro.features') as string[];
  const studioFeatures = t.raw('pricing.studio.features') as string[];

  // ── State ─────────────────────────────────────────────────────────
  const [openFaq, setOpenFaq] = useState<number>(0);
  const [isYearly, setIsYearly] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [showPlayStoreModal, setShowPlayStoreModal] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  // ── Sticky CTA observer ───────────────────────────────────────────
  useEffect(() => {
    const heroEl = heroRef.current;
    if (!heroEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyCta(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(heroEl);
    return () => observer.disconnect();
  }, []);

  // ── Pricing helpers ───────────────────────────────────────────────
  const proMonthly = formatAmount(SUBSCRIPTION_PLANS.solo.monthlyPrice, locale);
  const proYearlyPerMonth = formatAmount(SUBSCRIPTION_PLANS.solo.yearlyPrice / 12, locale);
  const proYearlyTotal = formatAmount(SUBSCRIPTION_PLANS.solo.yearlyPrice, locale);

  const studioMonthly = formatAmount(SUBSCRIPTION_PLANS.team.baseMonthlyPrice, locale);
  const studioYearlyPerMonth = formatAmount(SUBSCRIPTION_PLANS.team.baseYearlyPrice / 12, locale);
  const studioYearlyTotal = formatAmount(SUBSCRIPTION_PLANS.team.baseYearlyPrice, locale);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Section 1 - Header ─────────────────────────────────────── */}
      <Header />

      <main className="flex-1 overflow-x-hidden">
        {/* ── Section 2 - Hero (cinematic full-bleed) ──────────────────
            Video plays as a full-bleed background; a dark gradient
            guarantees text legibility on any frame. Content is
            centered vertically and packed densely (headline, sub,
            three trust pills, CTAs, disclaimer) so the copy carries
            the message — the video stays atmospheric, not dominant.
            Same experience on mobile (video is compressed to ~2.8MB
            and the loader is the LCP). */}
        <section
          ref={heroRef}
          className="relative min-h-[640px] h-[72vh] max-h-[820px] overflow-hidden bg-gray-900"
        >
          {/* Background loader + video (sibling layers, parent sized) */}
          <HeroVideo variant="background" />

          {/* Vertical dark gradient — keeps text readable on any
              frame and gives the bottom CTAs the most contrast. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-black/80"
          />
          {/* Extra left-side darkening on wide viewports where the
              copy is left-aligned. No effect on mobile (centered). */}
          <div
            aria-hidden="true"
            className="hidden lg:block absolute inset-0 bg-gradient-to-r from-black/40 via-black/10 to-transparent"
          />

          {/* Foreground content — vertically centered so the copy
              occupies the optical middle of the frame, not the very
              bottom corner. */}
          <div className="relative z-10 h-full flex flex-col justify-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <div className="max-w-3xl text-center lg:text-left mx-auto lg:mx-0">
              <h1 className="animate-fade-in-up text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight drop-shadow-lg">
                {t('hero.title')}
              </h1>
              <p className="animate-fade-in-up animation-delay-150 mt-5 sm:mt-6 text-base sm:text-lg lg:text-xl text-white/90 max-w-2xl mx-auto lg:mx-0 drop-shadow-md">
                {t('hero.subtitle')}
              </p>

              {/* Trust pills — frosted-glass chips so they read on the
                  video without losing the cinematic feel. Three core
                  proof points: speed, no commission, entry price. */}
              <div className="animate-fade-in-up animation-delay-300 mt-6 sm:mt-7 flex flex-wrap items-center justify-center lg:justify-start gap-2 sm:gap-3">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs sm:text-sm font-medium">
                  <CalendarCheck className="w-4 h-4 text-primary-300" />
                  {t('hero.pillReady')}
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs sm:text-sm font-medium">
                  <BadgePercent className="w-4 h-4 text-primary-300" />
                  {t('hero.pillCommission')}
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs sm:text-sm font-medium">
                  <CreditCard className="w-4 h-4 text-primary-300" />
                  {t('hero.pillPrice', { price: proMonthly })}
                </span>
              </div>

              {/* CTAs — primary solid; secondary frosted-glass outline. */}
              <div className="animate-fade-in-up animation-delay-500 mt-7 sm:mt-8 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center bg-primary-600 text-white hover:bg-primary-500 hover:shadow-xl hover:shadow-primary-600/40 px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-200 w-full sm:w-auto"
                >
                  {t('hero.ctaCreate')}
                </Link>
                <Link
                  href={localizedPath('/p/demo', locale)}
                  className="inline-flex items-center justify-center border border-white/40 bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 hover:border-white/70 px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-200 w-full sm:w-auto"
                >
                  {t('hero.ctaDemo')}
                </Link>
              </div>
              <p className="animate-fade-in animation-delay-700 mt-4 text-sm text-white/80 text-center lg:text-left">
                {t('hero.disclaimer', { days: APP_CONFIG.trialDays })}
              </p>
            </div>
          </div>
        </section>

        {/* ── App Store strip ─────────────────────────────────────────
            Trust pills moved up into the Hero; this band is the
            dedicated install path for iOS (live) and Android
            (waitlist). Stacked + perfectly centered: small caption
            above, two badges below. Reads as a clean utility band,
            not as competing chrome. */}
        <section className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 py-6 sm:py-7">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center gap-3">
              <span className="text-xs sm:text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t('appStrip.caption')}
              </span>
              <div className="flex flex-row flex-wrap justify-center gap-3">
                <a
                  href="https://apps.apple.com/us/app/opatam-agenda-rendez-vous/id6759246218"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors shadow-sm"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-[10px] leading-tight opacity-80">{t('appStrip.downloadOn')}</div>
                    <div className="text-sm font-semibold leading-tight">App Store</div>
                  </div>
                </a>
                <button
                  onClick={() => setShowPlayStoreModal(true)}
                  className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-black/80 text-white rounded-xl hover:bg-gray-800 transition-colors shadow-sm relative"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-[10px] leading-tight opacity-80">{t('appStrip.soonOn')}</div>
                    <div className="text-sm font-semibold leading-tight">Google Play</div>
                  </div>
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-primary-500 text-white text-[10px] font-bold rounded-full shadow">
                    {t('appStrip.soonBadge')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Tutoriels ─────────────────────────────────────────────────
            Surfaced right after the Hero so the promise is made
            tangible before any other proof point. Hidden when the
            list is empty — the section component handles that. */}
        <TutorialsSection tutorials={tutorials} />

        {/* ── Section 3 - Social Proof Metrics ──────────────────────── */}
        <section className="py-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {statsItems.map((stat) => (
                <div key={stat.label}>
                  <p className="text-3xl sm:text-4xl font-extrabold text-primary-600 dark:text-primary-400">{stat.value}</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 3b - Instagram / Snapchat story feature ─────── */}
        <StorySection />

        {/* ── Section 4 - Main Features (Alternating) ──────────────── */}
        <section id="fonctionnalites" className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                {t('features.title')}
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                {t('features.subtitle', { app: APP_CONFIG.name })}
              </p>
            </div>

            <div className="space-y-20 lg:space-y-28">
              {mainFeatures.map((feature, index) => {
                const Icon = feature.icon;
                const isReversed = index % 2 === 1;
                return (
                  <div
                    key={feature.title}
                    className={`flex flex-col ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-10 lg:gap-16`}
                  >
                    {/* Text */}
                    <div className="flex-1 text-center lg:text-left">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 mb-4">
                        <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                        {feature.title}
                      </h3>
                      <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-lg mx-auto lg:mx-0">
                        {feature.description}
                      </p>
                    </div>

                    {/* Mockup visual — real image if available, CSS fallback otherwise */}
                    <div className="flex-1 w-full max-w-lg">
                      {feature.image ? (
                        <div className="rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <Image
                            src={feature.image}
                            alt={feature.title}
                            width={960}
                            height={640}
                            className="w-full h-auto"
                            priority={index === 0}
                          />
                        </div>
                      ) : (
                        <>
                          {feature.mockup === 'agenda' && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                <div className="flex gap-1.5">
                                  <div className="w-3 h-3 rounded-full bg-red-400" />
                                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                  <div className="w-3 h-3 rounded-full bg-green-400" />
                                </div>
                                <div className="flex-1 text-center text-xs text-gray-400">opatam.com/pro/calendar</div>
                              </div>
                              <div className="p-5">
                                <div className="flex items-center gap-3 mb-5">
                                  <Calendar className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('mockups.myAgenda')}</p>
                                    <p className="text-xs text-gray-500">{t('mockups.weekOf')}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                  {mockupDays.map((day, i) => (
                                    <div key={day} className="text-center">
                                      <p className="text-xs font-medium text-gray-500 mb-2">{day}</p>
                                      <div className="space-y-1.5">
                                        <div className="rounded bg-primary-200 dark:bg-primary-800" style={{ height: `${18 + (i * 7) % 20}px` }} />
                                        <div className="rounded bg-primary-400 dark:bg-primary-600" style={{ height: `${28 - (i * 3) % 10}px` }} />
                                        <div className="rounded bg-gray-100 dark:bg-gray-700" style={{ height: `${10 + (i * 2) % 8}px` }} />
                                        <div className="rounded bg-primary-300 dark:bg-primary-700" style={{ height: `${16 + (i * 4) % 12}px` }} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {feature.mockup === 'booking' && (
                            <div className="mx-auto w-64 sm:w-72">
                              <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl border border-gray-200 dark:border-gray-700 p-4 pb-6">
                                <div className="w-20 h-5 bg-gray-100 dark:bg-gray-700 rounded-full mx-auto mb-4" />
                                <div className="space-y-3">
                                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                                    <div className="w-12 h-12 rounded-full bg-primary-200 dark:bg-primary-800" />
                                    <div>
                                      <div className="h-3 w-28 bg-gray-300 dark:bg-gray-600 rounded mb-1.5" />
                                      <div className="h-2 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                                    </div>
                                  </div>
                                  <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                                    <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 mb-2">{t('mockups.chooseService')}</p>
                                    {mockupServices.map((s) => (
                                      <div key={s} className="flex items-center justify-between py-2 border-b border-primary-100 dark:border-primary-800 last:border-0">
                                        <span className="text-xs text-gray-700 dark:text-gray-300">{s}</span>
                                        <div className="w-4 h-4 rounded-full border-2 border-primary-400" />
                                      </div>
                                    ))}
                                  </div>
                                  <div className="bg-primary-600 text-white text-center py-2.5 rounded-xl text-sm font-semibold">
                                    {t('mockups.book')}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {feature.mockup === 'mobile' && (
                            <div className="mx-auto w-64 sm:w-72">
                              <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl border border-gray-200 dark:border-gray-700 p-4 pb-6">
                                <div className="w-20 h-5 bg-gray-100 dark:bg-gray-700 rounded-full mx-auto mb-4" />
                                <div className="space-y-3">
                                  <div className="bg-primary-600 rounded-xl p-3">
                                    <p className="text-xs font-semibold text-white mb-1">{t('mockups.today')}</p>
                                    <p className="text-2xl font-bold text-white">{t('mockups.todayCount')}</p>
                                    <p className="text-xs text-primary-200">{t('mockups.nextIn')}</p>
                                  </div>
                                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 flex items-start gap-2">
                                    <Bell className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-xs font-semibold text-green-800 dark:text-green-300">{t('mockups.newBooking')}</p>
                                      <p className="text-[10px] text-green-600 dark:text-green-400">{t('mockups.newBookingDetail')}</p>
                                    </div>
                                  </div>
                                  {mockupBookings.map((rdv) => (
                                    <div key={rdv.time} className="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                      <div className="text-xs font-bold text-primary-600 dark:text-primary-400 w-10">{rdv.time}</div>
                                      <div className="flex-1">
                                        <p className="text-xs font-medium text-gray-900 dark:text-white">{rdv.name}</p>
                                        <p className="text-[10px] text-gray-500">{rdv.service}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {feature.mockup === 'team' && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                <div className="flex gap-1.5">
                                  <div className="w-3 h-3 rounded-full bg-red-400" />
                                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                  <div className="w-3 h-3 rounded-full bg-green-400" />
                                </div>
                                <div className="flex-1 text-center text-xs text-gray-400">opatam.com/pro/members</div>
                              </div>
                              <div className="p-5">
                                <div className="flex items-center gap-3 mb-5">
                                  <Users className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('mockups.myTeam')}</p>
                                </div>
                                <div className="space-y-3">
                                  {mockupTeam.map((member, i) => (
                                    <div key={member.name} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                                      <div className={`w-10 h-10 rounded-full ${teamMemberColors[i]} flex items-center justify-center text-white text-xs font-bold`}>
                                        {member.name.split(' ').map(n => n[0]).join('')}
                                      </div>
                                      <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{member.name}</p>
                                        <p className="text-xs text-gray-500">{member.role}</p>
                                      </div>
                                      <span className="text-xs font-medium text-primary-600 dark:text-primary-400">{member.rdv}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Section 5 - Secondary Features Grid ──────────────────── */}
        <section className="py-16 sm:py-24 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                {t('secondaryFeatures.title')}
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                {t('secondaryFeatures.subtitle')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {secondaryFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="group bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-100 dark:border-gray-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-800"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                      <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Section 6 - Sectors ───────────────────────────────────── */}
        <section className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                {t('sectors.title')}
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                {t('sectors.subtitle', { app: APP_CONFIG.name })}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6">
              {sectors.map((sector) => {
                const Icon = sector.icon;
                return (
                  <div
                    key={sector.title}
                    className="group text-center p-5 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-800"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-3 transition-transform duration-300 group-hover:scale-110">
                      <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{sector.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{sector.examples}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Section 7 - How it works (animated) ─────────────────── */}
        <HowItWorksAnimated />

        {/* ── Section 8 - Testimonials ───────────────────────────────── */}
        <section id="temoignages" className="py-16 sm:py-24 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                {t('testimonials.title')}
              </h2>
            </div>

            {/* Testimonial cards - horizontal scroll on mobile, grid on desktop */}
            <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 md:grid md:grid-cols-3 md:overflow-x-visible md:snap-none md:pb-0 scrollbar-hide">
              {testimonials.map((item) => (
                <div
                  key={item.name}
                  className="flex-shrink-0 w-[85vw] sm:w-[380px] md:w-auto snap-center bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 relative transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary-200 dark:hover:border-primary-800"
                >
                  {/* Decorative quote */}
                  <Quote className="absolute top-4 right-4 w-8 h-8 text-primary-100 dark:text-primary-900/30" />

                  {/* Stars */}
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>

                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-6">
                    &ldquo;{item.text}&rdquo;
                  </p>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-sm font-bold text-primary-700 dark:text-primary-300">
                      {item.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {item.role}, {item.city}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 9 - Comparison ─────────────────────────────────── */}
        <section className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                {t('comparison.title', { app: APP_CONFIG.name })}
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                {t('comparison.subtitle')}
              </p>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block max-w-3xl mx-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-4 px-4 font-semibold text-gray-900 dark:text-white">{t('comparison.criterion')}</th>
                    <th className="py-4 px-4 font-semibold text-white bg-primary-600 rounded-t-lg">
                      {APP_CONFIG.name}
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-500 dark:text-gray-400">
                      {t('comparison.others')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''}>
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{row.label}</td>
                      <td className="py-3 px-4 text-center bg-primary-50 dark:bg-primary-900/20 font-semibold text-primary-700 dark:text-primary-300">
                        {row.opatam}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-500 dark:text-gray-400">
                        {row.others}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <div className="md:hidden space-y-3">
              {comparisonRows.map((row) => (
                <div
                  key={row.label}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4"
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{row.label}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-2.5 text-center">
                      <p className="text-xs text-gray-500 mb-0.5">{APP_CONFIG.name}</p>
                      <p className="font-semibold text-primary-700 dark:text-primary-300">{row.opatam}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2.5 text-center">
                      <p className="text-xs text-gray-500 mb-0.5">{t('comparison.others')}</p>
                      <p className="font-medium text-gray-600 dark:text-gray-300">{row.others}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footnote */}
            <p className="mt-6 text-xs text-gray-500 dark:text-gray-500 text-center max-w-2xl mx-auto">
              {t('comparison.footnote')}
            </p>
          </div>
        </section>

        {/* ── Section 10 - Pricing ───────────────────────────────────── */}
        <section id="tarifs" className="py-16 sm:py-24 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                {t('pricing.title')}
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                {t('pricing.subtitle')}
              </p>
            </div>

            {/* ── Early adopter pricing block ── */}
            <div className="max-w-5xl mx-auto">
              <div className="relative overflow-hidden rounded-3xl p-[1px]">
                {/* Animated golden border */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-amber-500/0 via-amber-400/60 to-amber-500/0 animate-shimmer pointer-events-none" />

                <div className="relative rounded-[calc(1.5rem-1px)] bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 dark:from-gray-950 dark:via-gray-950 dark:to-black overflow-hidden">
                  {/* Decorative glow orbs */}
                  <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-amber-500/8 blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-40 -left-20 w-72 h-72 rounded-full bg-primary-500/5 blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-40 -right-20 w-72 h-72 rounded-full bg-amber-400/5 blur-3xl pointer-events-none" />

                  {/* ─ Top section: guarantee message ─ */}
                  <div className="relative px-6 pt-10 pb-8 sm:px-10 sm:pt-12 sm:pb-10">
                    <div className="flex flex-col items-center text-center">
                      {/* Badge */}
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-5">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-xs font-semibold tracking-wider uppercase text-amber-400">{t('pricing.launchOffer')}</span>
                      </div>

                      {/* Icon + Headline inline */}
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25 flex-shrink-0">
                          <Lock className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-white text-left">
                          {t('pricing.guaranteedPrefix')}{' '}
                          <span className="bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-300 bg-clip-text text-transparent">
                            {t('pricing.guaranteedHighlight')}
                          </span>
                        </h3>
                      </div>

                      <p className="text-base text-gray-400 max-w-lg mb-6">
                        {t('pricing.guaranteeText')}
                      </p>

                      {/* Trust points */}
                      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 text-sm mb-2">
                        <div className="flex items-center gap-2 text-amber-300/90">
                          <Check className="w-4 h-4" />
                          <span>{t('pricing.trustLocked')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-amber-300/90">
                          <Check className="w-4 h-4" />
                          <span>{t('pricing.trustNoIncrease')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-amber-300/90">
                          <Check className="w-4 h-4" />
                          <span>{t('pricing.trustEarly')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ─ Separator ─ */}
                  <div className="mx-6 sm:mx-10 border-t border-gray-700/50" />

                  {/* ─ Middle section: toggle + cards ─ */}
                  <div className="relative px-6 py-8 sm:px-10 sm:py-10">
                    {/* Monthly / Yearly toggle */}
                    <div className="flex items-center justify-center gap-3 mb-8">
                      <span
                        className={`text-sm font-medium ${!isYearly ? 'text-white' : 'text-gray-500'}`}
                      >
                        {t('pricing.monthly')}
                      </span>
                      <button
                        onClick={() => setIsYearly(!isYearly)}
                        className={`relative w-14 h-7 rounded-full transition-colors ${isYearly ? 'bg-primary-600' : 'bg-gray-600'}`}
                        aria-label={t('pricing.toggleAria')}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${isYearly ? 'translate-x-7' : ''}`}
                        />
                      </button>
                      <span
                        className={`text-sm font-medium ${isYearly ? 'text-white' : 'text-gray-500'}`}
                      >
                        {t('pricing.yearly')}
                      </span>
                      {isYearly && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/20">
                          {t('pricing.save')}
                        </span>
                      )}
                    </div>

                    {/* Pricing cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch pt-4">
                      {/* Pro card */}
                      <div className="flex flex-col bg-white dark:bg-gray-800 rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                            {t('pricing.pro.name')}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                          {t('pricing.pro.description')}
                        </p>

                        <div className="mb-6">
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                              {isYearly ? proYearlyPerMonth : proMonthly}&euro;
                            </span>
                            <span className="text-base text-gray-500 font-medium">{t('pricing.perMonth')}</span>
                          </div>
                          {isYearly && (
                            <p className="text-sm text-gray-500 mt-1">
                              {t('pricing.billedYearly', { total: proYearlyTotal })}
                            </p>
                          )}
                          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-2">
                            {t('pricing.noCommitment')}
                          </p>
                        </div>

                        <div className="border-t border-gray-100 dark:border-gray-700 mb-6" />

                        <ul className="space-y-3 flex-1">
                          {proFeatures.map((f) => (
                            <li key={f} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary-50 dark:bg-primary-900/20 flex-shrink-0 mt-0.5">
                                <Check className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                              </div>
                              {f}
                            </li>
                          ))}
                        </ul>

                        <Link
                          href="/register"
                          className="mt-8 block w-full text-center bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 px-6 py-3.5 font-semibold rounded-xl transition-all duration-200 hover:shadow-lg"
                        >
                          {t('pricing.ctaCreate')}
                        </Link>
                      </div>

                      {/* Studio card (popular) */}
                      <div className="relative flex flex-col bg-white dark:bg-gray-800 rounded-2xl p-7 border-2 border-primary-500 shadow-xl shadow-primary-500/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary-500/15">
                        {/* Popular badge */}
                        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/25">
                          <Star className="w-3.5 h-3.5" />
                          {t('pricing.popular')}
                        </span>

                        <div className="relative">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                              <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                              {t('pricing.studio.name')}
                            </h3>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                            {t('pricing.studio.description')}
                          </p>

                          <div className="mb-6">
                            <div className="flex items-baseline gap-1">
                              <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                                {isYearly ? studioYearlyPerMonth : studioMonthly}&euro;
                              </span>
                              <span className="text-base text-gray-500 font-medium">{t('pricing.perMonth')}</span>
                            </div>
                            {isYearly && (
                              <p className="text-sm text-gray-500 mt-1">
                                {t('pricing.billedYearly', { total: studioYearlyTotal })}
                              </p>
                            )}
                            <p className="text-xs text-primary-700 dark:text-primary-300 font-semibold mt-1.5">
                              {t('pricing.upTo10')}
                            </p>
                            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-2">
                              {t('pricing.noCommitment')}
                            </p>
                          </div>

                          <div className="border-t border-primary-100 dark:border-primary-900/30 mb-6" />

                          <ul className="space-y-3 flex-1">
                            {studioFeatures.map((f) => (
                              <li key={f} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/20 flex-shrink-0 mt-0.5">
                                  <Check className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                                </div>
                                {f}
                              </li>
                            ))}
                          </ul>

                          <Link
                            href="/register"
                            className="mt-8 block w-full text-center bg-primary-600 text-white hover:bg-primary-700 px-6 py-3.5 font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30"
                          >
                            {t('pricing.ctaCreate')}
                          </Link>
                        </div>
                      </div>
                    </div>

                    {/* Bottom note */}
                    <p className="mt-8 text-sm text-gray-500 text-center">
                      {t('pricing.trialNote', { days: APP_CONFIG.trialDays })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TutorialsSection moved up — see right after the Hero. */}

        {/* ── Section 11 - FAQ ───────────────────────────────────────── */}
        <section id="faq" className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                {t('faq.title')}
              </h2>
            </div>

            <div className="space-y-4">
              {faqItems.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div
                    key={index}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? -1 : index)}
                      className="w-full flex items-center justify-between p-5 text-left"
                    >
                      <span className="text-sm font-semibold text-gray-900 dark:text-white pr-4">
                        {item.question}
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5">
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{item.answer}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Section 12 - Final CTA ─────────────────────────────────── */}
        <section className="py-16 sm:py-24 bg-primary-600">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">{t('finalCta.title')}</h2>
            <p className="mt-4 text-lg text-white/80">
              {t('finalCta.subtitle')}
            </p>

            <div className="mt-10">
              <Link
                href="/register"
                className="inline-flex items-center justify-center bg-white text-primary-700 hover:bg-gray-50 px-8 py-4 text-lg font-semibold shadow-lg rounded-lg transition-colors"
              >
                {t('finalCta.cta')}
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/80">
              {t('finalCta.disclaimer', { days: APP_CONFIG.trialDays })}
            </p>

            <div className="mt-8 flex flex-row flex-wrap gap-3 justify-center">
              <a
                href="https://apps.apple.com/us/app/opatam-agenda-rendez-vous/id6759246218"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-5 py-3 bg-white/10 backdrop-blur text-white border border-white/20 rounded-xl hover:bg-white/20 transition-colors"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <div className="text-left">
                  <div className="text-[10px] leading-tight opacity-80">{t('finalCta.availableOn')}</div>
                  <div className="text-sm font-semibold leading-tight">App Store</div>
                </div>
              </a>
              <button
                onClick={() => setShowPlayStoreModal(true)}
                className="inline-flex items-center gap-2.5 px-5 py-3 bg-white/5 backdrop-blur text-white border border-white/15 rounded-xl hover:bg-white/15 transition-colors relative"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                </svg>
                <div className="text-left">
                  <div className="text-[10px] leading-tight opacity-70">{t('finalCta.soonOn')}</div>
                  <div className="text-sm font-semibold leading-tight">Google Play</div>
                </div>
                <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-primary-500 text-white text-[10px] font-bold rounded-full shadow">
                  {t('finalCta.soonBadge')}
                </span>
              </button>
            </div>

            {/* Social links */}
            <div className="mt-8">
              <p className="text-sm text-white/50 mb-3">{t('finalCta.followUs')}</p>
              <SocialLinks variant="light" className="justify-center" />
            </div>
          </div>
        </section>

        {/* ── Section 13 - Marketplace redirect ──────────────────────── */}
        <section className="py-8 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('marketplace.lookingFor')}{' '}
              <Link
                href="/recherche"
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium inline-flex items-center gap-1 transition-colors"
              >
                {t('marketplace.searchPro')} <ArrowRight className="w-4 h-4" />
              </Link>
            </p>
          </div>
        </section>
      </main>

      {/* ── Section 14 - Footer ────────────────────────────────────── */}
      <Footer />

      {/* ── Sticky mobile CTA ────────────────────────────────────────── */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 md:hidden transition-transform duration-300 ${
          showStickyCta ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-3 shadow-lg">
          <Link
            href="/register"
            className="block w-full text-center bg-primary-600 text-white hover:bg-primary-700 px-6 py-3 font-semibold rounded-lg transition-colors"
          >
            {t('stickyCta', { days: APP_CONFIG.trialDays })}
          </Link>
        </div>
      </div>

      {/* Play Store Waitlist Modal */}
      <PlayStoreWaitlistModal
        isOpen={showPlayStoreModal}
        onClose={() => setShowPlayStoreModal(false)}
      />
    </div>
  );
}
