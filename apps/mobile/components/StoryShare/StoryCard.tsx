/**
 * StoryCard — Instagram Story template (1080×1920 ratio)
 *
 * Generates a beautiful story image with:
 * - Provider photo / logo
 * - Business name & category
 * - Up to 5 services with prices OR weekly hours (grouped)
 * - QR code for booking
 * - OPATAM branding
 *
 * Rendered off-screen and captured via react-native-view-shot.
 */

import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../Text';

// Safe import — react-native-qrcode-svg requires native module (react-native-svg)
// which may not be installed in all builds (e.g. Expo Go or missing pod install).
let QRCode: React.ComponentType<any> | null = null;
try {
  QRCode = require('react-native-qrcode-svg').default;
} catch {
  // Native module not available
}
import { APP_CONFIG, ASSETS } from '@booking-app/shared/constants';

/** A single day in the "Disponibilités" story mode (computed from real
 *  bookings + opening hours, see useUpcomingAvailabilities). */
export interface AvailabilityDay {
  dateKey: string;
  weekday: string;     // "Lun"
  dayOfMonth: number;  // 6
  /** Half-hour bucket indices that are free. hour*2 + (min>=30?1:0). */
  freeHalfHours: Set<number>;
  isAvailable: boolean;
}

export interface AvailabilityGrid {
  days: AvailabilityDay[];
  minHour: number;
  maxHour: number;
}

/** Visual theme for the entire story (applies to every displayMode). */
export type StoryTheme = 'light' | 'dark';

/** @deprecated kept as alias for back-compat with existing call sites. */
export type AvailabilityTheme = StoryTheme;

export interface StoryCardProps {
  businessName: string;
  category: string;
  city?: string;
  photoURL?: string | null;
  services: Array<{ name: string; price: number; duration: number }>;
  bookingUrl: string;
  displayMode?: 'services' | 'availabilities' | 'none';
  availabilityGrid?: AvailabilityGrid;
  /** Theme for the standard layout (services / QR Code) AND the
   *  availability calendar. One toggle, applied everywhere. */
  storyTheme?: StoryTheme;
  /** Override the standard layout gradient — only used in light mode
   *  (dark mode pulls its own gradient from the palette). */
  gradientColors?: [string, string, string];
}

// Story dimensions (9:16 ratio, scaled down for rendering — captured at high res)
const STORY_WIDTH = 360;
const STORY_HEIGHT = 640;

// ─── Availability story (full-canvas layout) ─────────────────────────────

const MONTHS_SHORT = [
  'janv', 'févr', 'mars', 'avr', 'mai', 'juin',
  'juill', 'août', 'sept', 'oct', 'nov', 'déc',
];

interface ThemePalette {
  /** When set, renders the canvas with a LinearGradient using these
   *  colors (matches the standard story card backgrounds). When null,
   *  the canvas uses the flat `bg` color. */
  gradient: [string, string, string] | null;
  bg: string;
  decor: string;
  text: string;
  textMuted: string;
  avatarBg: string;
  avatarText: string;
  cellFree: string;
  cellBusy: string;
  legendDotMuted: string;
  footerBg: string;
  footerText: string;
}

const DARK_PALETTE: ThemePalette = {
  gradient: null,
  bg: '#0a1628',
  decor: 'rgba(37,99,235,0.05)',
  text: '#ffffff',
  textMuted: '#6b7280',
  avatarBg: '#1f2937',
  avatarText: '#ffffff',
  cellFree: '#2563eb',
  cellBusy: '#1a2438',
  legendDotMuted: '#1a2438',
  footerBg: 'transparent',
  footerText: '#ffffff',
};

// Light theme — same gradient as the other story modes (services /
// hours / QR Code) so the share output stays visually coherent
// regardless of which mode the pro picks.
const LIGHT_PALETTE: ThemePalette = {
  gradient: ['#ffffff', '#f0f4f8', '#e2e8f0'],
  bg: '#ffffff',
  decor: 'rgba(26,109,175,0.06)',
  text: '#0f172a',
  textMuted: '#64748b',
  avatarBg: '#1a6daf',
  avatarText: '#ffffff',
  cellFree: '#1a6daf',
  cellBusy: 'rgba(15,23,42,0.07)',
  legendDotMuted: 'rgba(15,23,42,0.10)',
  footerBg: 'transparent',
  footerText: '#1a6daf',
};

/** Format the date range covered by the grid as "6 → 12 mai 2026"
 *  (or with cross-month / cross-year handling). */
function formatDateRange(days: AvailabilityDay[]): string {
  if (days.length === 0) return '';
  const parse = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const first = parse(days[0].dateKey);
  const last = parse(days[days.length - 1].dateKey);
  const sameMonth = first.getMonth() === last.getMonth();
  const sameYear = first.getFullYear() === last.getFullYear();
  if (sameMonth && sameYear) {
    return `${first.getDate()} → ${last.getDate()} ${MONTHS_SHORT[last.getMonth()]} ${last.getFullYear()}`;
  }
  if (sameYear) {
    return `${first.getDate()} ${MONTHS_SHORT[first.getMonth()]} → ${last.getDate()} ${MONTHS_SHORT[last.getMonth()]} ${last.getFullYear()}`;
  }
  return `${first.getDate()} ${MONTHS_SHORT[first.getMonth()]} ${first.getFullYear()} → ${last.getDate()} ${MONTHS_SHORT[last.getMonth()]} ${last.getFullYear()}`;
}

/** Full-canvas availability story — replaces the standard StoryCard
 *  layout when displayMode === 'availabilities'. */
function AvailabilityStoryLayout({
  businessName,
  category,
  city,
  photoURL,
  grid,
  theme,
}: {
  businessName: string;
  category: string;
  city?: string;
  photoURL?: string | null;
  grid: AvailabilityGrid;
  theme: AvailabilityTheme;
}) {
  const palette = theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
  const dateRange = formatDateRange(grid.days);

  const hourLabels: number[] = [];
  for (let h = grid.minHour; h <= grid.maxHour; h++) hourLabels.push(h);

  // Pull initials from the business name for the avatar fallback —
  // matches the "KT" style in the design reference.
  const initials = businessName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || 'O';

  // Inner content is identical regardless of theme — only the wrapper
  // changes (gradient vs flat). Hoisting it avoids duplicating ~80
  // lines of JSX between the two branches.
  const inner = (
    <>
      {/* Decorative circle in the top-right (matches the reference) */}
      <View style={[availStoryStyles.decorCircle, { backgroundColor: palette.decor }]} />

      {/* Header: avatar + business identity */}
      <View style={availStoryStyles.header}>
        <View style={[availStoryStyles.avatar, { backgroundColor: palette.avatarBg }]}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={availStoryStyles.avatarImg} />
          ) : (
            <Text style={[availStoryStyles.avatarInitials, { color: palette.avatarText }]}>
              {initials}
            </Text>
          )}
        </View>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text
            style={[availStoryStyles.bizName, { color: palette.text }]}
            numberOfLines={1}
          >
            {businessName.toUpperCase()}
          </Text>
          <Text
            style={[availStoryStyles.bizSubtitle, { color: palette.textMuted }]}
            numberOfLines={1}
          >
            {[category, city].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      {/* Big title */}
      <Text style={[availStoryStyles.bigTitle, { color: palette.text }]}>
        Mes dispos{'\n'}de la semaine
      </Text>
      {!!dateRange && (
        <Text style={[availStoryStyles.dateRange, { color: palette.textMuted }]}>
          {dateRange}
        </Text>
      )}

      {/* Day headers */}
      <View style={availStoryStyles.dayHeaderRow}>
        <View style={availStoryStyles.hourCol} />
        {grid.days.map((day) => (
          <View key={day.dateKey} style={availStoryStyles.dayHeaderCell}>
            <Text style={[availStoryStyles.dayName, { color: palette.textMuted }]}>
              {day.weekday.toUpperCase()}
            </Text>
            <Text style={[availStoryStyles.dayNum, { color: palette.text }]}>
              {day.dayOfMonth}
            </Text>
          </View>
        ))}
      </View>

      {/* Grid rows — one per hour */}
      <View style={availStoryStyles.gridBody}>
        {hourLabels.map((hour) => (
          <View key={hour} style={availStoryStyles.gridRow}>
            <View style={availStoryStyles.hourCol}>
              <Text
                style={[availStoryStyles.hourLabel, { color: palette.textMuted }]}
              >
                {hour}h
              </Text>
            </View>
            {grid.days.map((day) => {
              // One pill per hour; the inner "free" fill is positioned
              // proportionally inside it so the visual matches reality:
              //   both halves free → fill 100%
              //   first half only  → fill top 50% (HH:00-HH:30)
              //   second half only → fill bottom 50% (HH:30-HH+1:00)
              //   neither          → no fill, the busy background shows
              const firstFree = day.freeHalfHours.has(hour * 2);
              const secondFree = day.freeHalfHours.has(hour * 2 + 1);
              let fillStyle: { top: `${number}%`; height: `${number}%` } | null = null;
              if (firstFree && secondFree) {
                fillStyle = { top: '0%', height: '100%' };
              } else if (firstFree) {
                fillStyle = { top: '0%', height: '50%' };
              } else if (secondFree) {
                fillStyle = { top: '50%', height: '50%' };
              }
              return (
                <View key={day.dateKey} style={availStoryStyles.cellWrap}>
                  <View
                    style={[
                      availStoryStyles.cell,
                      { backgroundColor: palette.cellBusy },
                    ]}
                  >
                    {fillStyle && (
                      <View
                        style={[
                          availStoryStyles.cellFill,
                          fillStyle,
                          { backgroundColor: palette.cellFree },
                        ]}
                      />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={availStoryStyles.legend}>
        <View style={availStoryStyles.legendItem}>
          <View style={[availStoryStyles.legendDot, { backgroundColor: palette.cellFree }]} />
          <Text style={[availStoryStyles.legendText, { color: palette.text }]}>
            Libre
          </Text>
        </View>
        <View style={availStoryStyles.legendItem}>
          <View style={[availStoryStyles.legendDot, { backgroundColor: palette.legendDotMuted }]} />
          <Text style={[availStoryStyles.legendText, { color: palette.textMuted }]}>
            Occupé
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={availStoryStyles.footer}>
        <Text style={[availStoryStyles.footerText, { color: palette.footerText }]}>
          opatam.com
        </Text>
      </View>
    </>
  );

  if (palette.gradient) {
    return (
      <LinearGradient
        colors={palette.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={availStoryStyles.canvas}
      >
        {inner}
      </LinearGradient>
    );
  }

  return (
    <View style={[availStoryStyles.canvas, { backgroundColor: palette.bg }]}>
      {inner}
    </View>
  );
}

const availStoryStyles = StyleSheet.create({
  canvas: {
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    paddingHorizontal: 24,
    paddingTop: 32,
    // Generous bottom safe-zone so the pro can drop a link sticker /
    // mention / poll on Instagram Stories without overlapping our
    // legend or footer. ~14% of the canvas height matches IG's own
    // reactions/reply area on real devices.
    paddingBottom: 92,
    overflow: 'hidden',
    position: 'relative',
  },
  decorCircle: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  bizName: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  bizSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
    letterSpacing: 0.2,
  },

  // Big title
  bigTitle: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  dateRange: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    marginBottom: 18,
  },

  // Day headers row
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  hourCol: {
    width: 28,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayName: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  dayNum: {
    fontSize: 16,
    fontWeight: '800',
  },

  // Grid body
  gridBody: {
    flex: 1,
    justifyContent: 'space-between',
    marginTop: 4,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  hourLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  cellWrap: {
    flex: 1,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  cell: {
    width: '100%',
    aspectRatio: 2.2, // wide-ish rectangle, matches the design ref
    borderRadius: 5,
    minHeight: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  cellFill: {
    position: 'absolute',
    left: 0,
    right: 0,
  },

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    marginTop: 12,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Footer
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footerPill: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 24,
  },
  footerPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

// ─── Standard story palette (services / QR Code modes) ─────────────────

interface StandardPalette {
  gradient: [string, string, string];
  decorTop: string;
  decorBottom: string;
  avatarBorder: string;
  avatarPlaceholderBg: string;
  avatarInitial: string;
  businessName: string;
  subtitle: string;
  dividerLine: string;
  sectionTitle: string;
  cardSectionBg: string;
  cardSectionBorder: string;
  serviceDot: string;
  serviceName: string;
  serviceLine: string;
  servicePrice: string;
  qrContainerBg: string; // Stays white in both modes — QR codes need contrast
  qrLabel: string;
  brandingText: string;
  brandingDivider: string;
}

const STANDARD_LIGHT: StandardPalette = {
  gradient: ['#ffffff', '#f0f4f8', '#e2e8f0'],
  decorTop: 'rgba(26,109,175,0.06)',
  decorBottom: 'rgba(26,109,175,0.04)',
  avatarBorder: 'rgba(26,109,175,0.15)',
  avatarPlaceholderBg: '#1a6daf',
  avatarInitial: '#ffffff',
  businessName: '#111827',
  subtitle: '#6b7280',
  dividerLine: '#1a6daf',
  sectionTitle: '#9ca3af',
  cardSectionBg: 'rgba(26,109,175,0.06)',
  cardSectionBorder: 'rgba(26,109,175,0.10)',
  serviceDot: '#1a6daf',
  serviceName: '#374151',
  serviceLine: '#e5e7eb',
  servicePrice: '#111827',
  qrContainerBg: '#ffffff',
  qrLabel: '#9ca3af',
  brandingText: '#374151',
  brandingDivider: '#e5e7eb',
};

const STANDARD_DARK: StandardPalette = {
  gradient: ['#0a1628', '#0d1c33', '#0a1628'],
  decorTop: 'rgba(37,99,235,0.10)',
  decorBottom: 'rgba(37,99,235,0.06)',
  avatarBorder: 'rgba(255,255,255,0.15)',
  avatarPlaceholderBg: '#1a6daf',
  avatarInitial: '#ffffff',
  businessName: '#ffffff',
  subtitle: '#9ca3af',
  dividerLine: '#60a5fa',
  sectionTitle: '#9ca3af',
  cardSectionBg: 'rgba(255,255,255,0.05)',
  cardSectionBorder: 'rgba(255,255,255,0.10)',
  serviceDot: '#60a5fa',
  serviceName: '#ffffff',
  serviceLine: 'rgba(255,255,255,0.12)',
  servicePrice: '#60a5fa',
  qrContainerBg: '#ffffff',
  qrLabel: '#9ca3af',
  brandingText: '#9ca3af',
  brandingDivider: 'rgba(255,255,255,0.12)',
};

// ─── Component ───────────────────────────────────────────────────────────

export function StoryCard({
  businessName,
  category,
  city,
  photoURL,
  services,
  bookingUrl,
  displayMode = 'services',
  availabilityGrid,
  storyTheme = 'light',
  gradientColors,
}: StoryCardProps) {
  const topServices = services.slice(0, 5);
  const subtitle = [category, city].filter(Boolean).join(' • ').toUpperCase();
  const palette = storyTheme === 'dark' ? STANDARD_DARK : STANDARD_LIGHT;
  // gradientColors prop overrides only in light mode — dark mode always
  // uses the dedicated dark palette so the toggle is unambiguous.
  const activeGradient =
    storyTheme === 'light' && gradientColors ? gradientColors : palette.gradient;

  // QR code only shown in 'none' mode (renamed "QR Code")
  const showQR = displayMode === 'none';

  // The "availabilities" mode uses a fully custom full-canvas layout
  // (matches the design reference) instead of the generic gradient
  // story shell. We bail out early here so none of the standard
  // sections (avatar, divider, services, etc.) bleed through.
  if (displayMode === 'availabilities' && availabilityGrid && availabilityGrid.days.length > 0) {
    return (
      <View style={styles.container}>
        <AvailabilityStoryLayout
          businessName={businessName}
          category={category}
          city={city}
          photoURL={photoURL}
          grid={availabilityGrid}
          theme={storyTheme}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={activeGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Decorative circles */}
        <View style={[styles.decorCircleTop, { backgroundColor: palette.decorTop }]} />
        <View style={[styles.decorCircleBottom, { backgroundColor: palette.decorBottom }]} />

        {/* Content */}
        <View style={styles.content}>
          {/* Top spacer */}
          <View style={{ flex: 0.8 }} />

          {/* Avatar */}
          <View style={styles.avatarSection}>
            {photoURL ? (
              <Image
                source={{ uri: photoURL }}
                style={[styles.avatar, { borderColor: palette.avatarBorder }]}
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.avatarPlaceholder,
                  { borderColor: palette.avatarBorder, backgroundColor: palette.avatarPlaceholderBg },
                ]}
              >
                <Text style={[styles.avatarInitial, { color: palette.avatarInitial }]}>
                  {businessName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Business info */}
          <View style={styles.infoSection}>
            <Text
              style={[styles.businessName, { color: palette.businessName }]}
              numberOfLines={2}
            >
              {businessName}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: palette.subtitle }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: palette.dividerLine }]} />

          {/* Services */}
          {displayMode === 'services' && topServices.length > 0 && (
            <View
              style={[
                styles.cardSection,
                topServices.length > 3 && styles.cardSectionCompact,
                { backgroundColor: palette.cardSectionBg, borderColor: palette.cardSectionBorder },
              ]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  { color: palette.sectionTitle },
                  topServices.length > 3 && { marginBottom: 8 },
                ]}
              >
                Nos prestations
              </Text>
              {topServices.map((service, index) => (
                <View key={index} style={[styles.serviceRow, topServices.length > 3 && { marginBottom: 6 }]}>
                  <View style={[styles.serviceDot, { backgroundColor: palette.serviceDot }]} />
                  <Text
                    style={[
                      styles.serviceName,
                      { color: palette.serviceName },
                      topServices.length > 3 && { fontSize: 13 },
                    ]}
                    numberOfLines={1}
                  >
                    {service.name}
                  </Text>
                  <View style={[styles.serviceLine, { backgroundColor: palette.serviceLine }]} />
                  <Text
                    style={[
                      styles.servicePrice,
                      { color: palette.servicePrice },
                      topServices.length > 3 && { fontSize: 14 },
                    ]}
                  >
                    {service.price === 0 ? 'Gratuit' : `${(service.price / 100).toFixed(0)}€`}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* "Availabilities" mode is rendered above via the early-return
              path with a full-canvas layout — never reaches here. */}

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* QR Code section — only in QR Code mode */}
          {showQR && (
            <View style={styles.qrSection}>
              <View style={[styles.qrContainer, { backgroundColor: palette.qrContainerBg }]}>
                {QRCode ? (
                  <QRCode
                    value={bookingUrl}
                    size={140}
                    backgroundColor="white"
                    color="#111827"
                  />
                ) : (
                  <View style={{ width: 140, height: 140, backgroundColor: '#f3f4f6', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 10, color: '#9ca3af' }}>QR</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.qrLabel, { color: palette.qrLabel }]}>
                Scannez pour réserver
              </Text>
            </View>
          )}

          {/* Branding */}
          <View style={styles.brandingSection}>
            <View style={[styles.brandingDivider, { backgroundColor: palette.brandingDivider }]} />
            <View style={styles.brandingCenter}>
              <Image
                source={{ uri: ASSETS.logos.default }}
                style={styles.brandingLogo}
                resizeMode="contain"
              />
              <Text style={[styles.brandingText, { color: palette.brandingText }]}>
                opatam.com
              </Text>
            </View>
            <View style={[styles.brandingDivider, { backgroundColor: palette.brandingDivider }]} />
          </View>

          {/* Bottom spacer */}
          <View style={{ flex: 0.3 }} />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    position: 'relative',
  },
  decorCircleTop: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(26,109,175,0.06)',
  },
  decorCircleBottom: {
    position: 'absolute',
    bottom: -80,
    left: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(26,109,175,0.04)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
  },

  // Avatar
  avatarSection: {
    marginBottom: 16,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: 'rgba(26,109,175,0.15)',
  },
  avatarPlaceholder: {
    backgroundColor: '#1a6daf',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Info
  infoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  businessName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 6,
    letterSpacing: 0.5,
  },

  // Divider
  divider: {
    width: 40,
    height: 2,
    backgroundColor: '#1a6daf',
    borderRadius: 1,
    marginBottom: 20,
  },

  // Shared
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  cardSection: {
    width: '100%',
    backgroundColor: 'rgba(26,109,175,0.06)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(26,109,175,0.1)',
  },
  cardSectionCompact: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },

  // Services
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  serviceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1a6daf',
    marginRight: 10,
  },
  serviceName: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },
  serviceLine: {
    flex: 0.3,
    height: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 8,
  },
  servicePrice: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '700',
  },

  // QR Code
  qrSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  qrContainer: {
    padding: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  qrLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    letterSpacing: 0.5,
  },

  // Branding
  brandingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  brandingDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  brandingCenter: {
    alignItems: 'center',
    gap: 2,
  },
  brandingLogo: {
    width: 28,
    height: 28,
  },
  brandingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 2,
  },
});
