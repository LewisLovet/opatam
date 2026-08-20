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
// i18n.t (not useTranslation) : les textes de la story sont aussi produits
// dans des helpers hors composant ; la langue est figée au moment du rendu,
// ce qui suffit puisque la carte est recapturée à chaque partage.
import i18n from '../../lib/i18n';
import { Text } from '../Text';

// Safe import — react-native-qrcode-svg requires native module (react-native-svg)
// which may not be installed in all builds (e.g. Expo Go or missing pod install).
let QRCode: React.ComponentType<any> | null = null;
try {
  QRCode = require('react-native-qrcode-svg').default;
} catch {
  // Native module not available
}
// Import protégé, comme pour le QR code : `react-native-svg` est un module
// natif, absent de certains binaires (Expo Go, pods non installés). Le sceau
// cranté cède alors la place à un disque plein — la story reste publiable.
let Svg: React.ComponentType<any> | null = null;
let SvgPolygon: React.ComponentType<any> | null = null;
try {
  const mod = require('react-native-svg');
  Svg = mod.default ?? mod.Svg;
  SvgPolygon = mod.Polygon;
} catch {
  // Module natif indisponible.
}
import { Ionicons } from '@expo/vector-icons';
import { APP_CONFIG, getCategoryLabel } from '@booking-app/shared/constants';

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
  displayMode?: 'services' | 'availabilities' | 'none' | 'review' | 'loyalty';
  availabilityGrid?: AvailabilityGrid;
  /** Month availability grid (per-day status) — used when availabilityScope
   *  is 'month'. Adapts to the chosen prestation (or the general view). */
  monthGrid?: MonthAvailabilityGrid;
  /**
   * Inside the "availabilities" mode, switch between the existing
   * 7-day heatmap, a today-only list of free slots, and the month
   * per-day status grid.
   * Defaults to 'week' to preserve the historical render.
   */
  availabilityScope?: 'week' | 'day' | 'month';
  /** Theme for the standard layout (services / QR Code) AND the
   *  availability calendar. One toggle, applied everywhere. */
  storyTheme?: StoryTheme;
  /** Override the standard layout gradient — only used in light mode
   *  (dark mode pulls its own gradient from the palette). */
  gradientColors?: [string, string, string];
  /** L'avis mis en avant. Absent = la story bascule sur la note globale. */
  review?: StoryReview | null;
  /** Note moyenne et nombre d'avis, pour le repli sans commentaire. */
  ratingAverage?: number;
  ratingCount?: number;
  /** Programme de fidélité, pour la story du même nom. */
  loyalty?: StoryLoyalty | null;
}

/** Le programme de fidélité, tel que la story l'affiche. */
export interface StoryLoyalty {
  /** Nombre de rendez-vous honorés qui arment la récompense. */
  threshold: number;
  /** Récompense déjà mise en forme : « −25 % », « −10 € ». */
  reward: string;
  /**
   * Prestations exclues, par leur nom. Vide = toutes éligibles.
   * Affichées parce qu'une carte de fidélité qui tait ses exceptions se
   * retourne au comptoir, le jour où la cliente réclame sa réduction.
   */
  excluded: string[];
}

/** L'avis tel que la story l'affiche — déjà nettoyé par l'appelant. */
export interface StoryReview {
  rating: number;
  /** `null` quand la cliente n'a laissé qu'une note. */
  comment: string | null;
  /** Déjà réduit au prénom — la story n'assainit rien elle-même. */
  authorName: string;
  /**
   * Avis rattaché à une vraie réservation. Seuls ceux-là portent la mention
   * « cliente vérifiée » : l'apposer partout en ferait un ornement, et un
   * avis importé ou anonyme n'a rien vérifié du tout.
   */
  verified: boolean;
}

// Story dimensions (9:16 ratio, scaled down for rendering — captured at high res)
const STORY_WIDTH = 360;
const STORY_HEIGHT = 640;

// ─── Availability story (full-canvas layout) ─────────────────────────────

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

  const hourLabels: number[] = [];
  for (let h = grid.minHour; h <= grid.maxHour; h++) hourLabels.push(h);

  // Compute the per-row height precisely from what's left of the
  // canvas after the surrounding chrome (avatar header, big title,
  // date range, day-headers, legend, footer, IG safe-zones). The
  // previous layout relied on `flex: 1` on each row plus
  // `aspectRatio: 2.2` on the cell, which on a typical 14-hour
  // window squeezed each row to ~17 px — too short for the 10-pt
  // hour label, so labels overflowed into their neighbours and
  // got visually clipped (see user feedback). Mirrors the pattern
  // already used in TodayAvailabilityLayout.
  //
  // Numbers track the styles below — keep them in sync if you
  // adjust paddings or font sizes elsewhere.
  const GRID_AVAILABLE_HEIGHT =
    STORY_HEIGHT
    - 32  /* canvas paddingTop */
    - 92  /* canvas paddingBottom (IG safe-zone) */
    - 36  /* avatar */
    - 18  /* header marginBottom */
    - 76  /* bigTitle 2 lines × 38 lineHeight */
    - 18  /* bigTitle → dayHeaderRow gap (used to host the date range) */
    - 30  /* dayHeaderRow (label + dayNum) */
    - 6   /* dayHeaderRow marginBottom */
    - 4   /* gridBody marginTop */
    - 12  /* legend marginTop */
    - 18  /* legend height */
    - 12  /* legend marginBottom */
    - 18; /* footer */

  // Row height clamped: floor at 16 px (the hour label uses
  // lineHeight 12 plus a 2-px breathing margin top/bottom), ceiling
  // at 36 px (otherwise short windows like 9-12h produce huge
  // empty rows that look weird). The cell rendered inside is
  // full-row-height with a small vertical inset.
  //
  // 14-hour windows (typical 8h→21h) → ~17 px / row, just enough
  // for the label not to overlap its neighbour. 10-hour windows
  // (9h→19h) → ~24 px / row, comfortable.
  const rowHeight = clamp(
    16,
    36,
    Math.floor(GRID_AVAILABLE_HEIGHT / Math.max(1, hourLabels.length)),
  );

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

      {/* Big title — date range used to live just below ("17 → 23
          mai 2026") but the day-header row that follows already
          shows each day number, and the user wanted the freed
          vertical space for the grid bars instead. */}
      <Text style={[availStoryStyles.bigTitle, { color: palette.text }]}>
        {i18n.t('storyShare.card.weekTitle')}
      </Text>

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

      {/* Grid rows — one per hour. Height is fixed (computed
          above) instead of flex-distributed, so the hour label
          always has enough room to render fully. Cells fill the
          row height and stretch to the available width. */}
      <View style={availStoryStyles.gridBody}>
        {hourLabels.map((hour) => (
          <View
            key={hour}
            style={[availStoryStyles.gridRow, { height: rowHeight }]}
          >
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
            {i18n.t('storyShare.card.free')}
          </Text>
        </View>
        <View style={availStoryStyles.legendItem}>
          <View style={[availStoryStyles.legendDot, { backgroundColor: palette.legendDotMuted }]} />
          <Text style={[availStoryStyles.legendText, { color: palette.textMuted }]}>
            {i18n.t('storyShare.card.busy')}
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

// ─── Today-only availability story (single-day list of free slots) ───────

/** Capitalize the first character (Intl gives lowercase weekdays in fr). */
function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Format a YYYY-MM-DD into a locale long date ("Vendredi 9 mai 2026" /
 *  "Friday, May 9, 2026") following the app language. */
function formatLongDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return capitalizeFirst(
    new Intl.DateTimeFormat(i18n.language, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date),
  );
}

/** "Complet …" headline of the fully-booked empty state. Reads naturally
 *  whatever the picked date is (today / tomorrow / a weekday). */
function fullyBookedLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return i18n.t('storyShare.card.fullyBookedToday');
  if (diffDays === 1) return i18n.t('storyShare.card.fullyBookedTomorrow');
  // Lowercase weekday in fr — the title reads as a sentence so it
  // shouldn't have a stranded capital ("de Samedi" looks wrong).
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }).format(target);
  return i18n.t('storyShare.card.fullyBookedOn', {
    weekday: i18n.language === 'fr' ? weekday.toLowerCase() : capitalizeFirst(weekday),
  });
}

/**
 * Today-only availability layout — minimalist agenda look.
 *
 * Design reference (mobile share preview):
 *   - Dark navy canvas (or light gradient mirroring the week story)
 *   - Top bar: business initials in a small bordered square (left)
 *     + "DISPOS DU JOUR" caption (right)
 *   - Date block: capitalised headline ("Jeudi 7 mai") with a small
 *     free-window summary underneath ("3h libres entre 12h et 20h")
 *   - Hour-by-hour timeline: one row per opening hour. Each row is
 *     either a flat dark cell (busy / closed) or a primary-blue
 *     pill labelled "Libre" (at least one half-hour bucket free).
 *   - Footer: opatam.com
 *
 * Deliberately icon-free — the pro asked for zero emoji in the
 * generated story, so all visual structure relies on typography
 * and the busy/free rectangles.
 */
function TodayAvailabilityLayout({
  businessName,
  photoURL,
  day,
  theme,
}: {
  businessName: string;
  photoURL?: string | null;
  day: AvailabilityDay;
  theme: AvailabilityTheme;
}) {
  const palette = theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;

  const dateParts = parseDateKey(day.dateKey);
  // Capitalised weekday + day number + long-form month, localized —
  // matches the reference design ("Jeudi 7 mai" / "Thursday, May 7").
  // Rendered as a single headline so the title block stays compact.
  const longDateLabel = capitalizeFirst(
    new Intl.DateTimeFormat(i18n.language, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(dateParts.year, dateParts.month, dateParts.day)),
  );
  const summary = summarizeFreeWindow(day);
  const isFullyBooked = day.freeHalfHours.size === 0;

  // Day's open-hours range. Falls back to a safe default when the
  // hook can't infer it (totally closed day → just show the empty
  // state).
  const minHour = clamp(0, 23, computeMinHour(day) ?? 9);
  const maxHour = clamp(minHour, 23, computeMaxHour(day) ?? 19);
  const hours: number[] = [];
  for (let h = minHour; h <= maxHour; h++) hours.push(h);

  const initials =
    businessName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || 'O';

  // Above this row count we split the timeline into two columns so
  // the rows stay legible (a salon open midnight-to-22h would
  // squeeze 23 rows into the canvas otherwise — far too cramped).
  const TWO_COLUMN_THRESHOLD = 14;
  const twoColumns = hours.length > TWO_COLUMN_THRESHOLD;
  const rowsPerColumn = twoColumns ? Math.ceil(hours.length / 2) : hours.length;

  // Rows FLEX to fill the timeline (flex:1) container, so they always
  // fit the canvas whatever the opening range — no fragile pixel
  // budgeting that silently drifts out of sync with the styles and
  // clips the last hour. `maxRowHeight` only stops a near-empty day
  // from rendering giant rows; the gap keeps them separated.
  const rowGap = twoColumns ? 4 : 6;
  const maxRowHeight = twoColumns ? 28 : 34;

  const inner = (
    <>
      {/* Top bar — round avatar on the left (same look as the week
          story header) + "DISPOS DU JOUR" caption on the right. */}
      <View style={todayStyles.topBar}>
        <View style={[availStoryStyles.avatar, { backgroundColor: palette.avatarBg }]}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={availStoryStyles.avatarImg} />
          ) : (
            <Text
              style={[availStoryStyles.avatarInitials, { color: palette.avatarText }]}
            >
              {initials}
            </Text>
          )}
        </View>
        <Text
          style={[todayStyles.captionLabel, { color: palette.text }]}
          numberOfLines={1}
        >
          {i18n.t('storyShare.card.dayCaption')}
        </Text>
      </View>

      {/* Compact date block: capitalised headline + free-window summary.
          Designed to read as a single sentence ("Jeudi 7 mai" /
          "3h libres entre 12h et 20h") so the timeline below has
          maximum vertical room. */}
      <View style={todayStyles.dateBlock}>
        <Text
          style={[todayStyles.title, { color: palette.text }]}
          numberOfLines={1}
        >
          {longDateLabel}
        </Text>
        {summary && (
          <Text
            style={[todayStyles.subtitle, { color: palette.textMuted }]}
            numberOfLines={1}
          >
            {i18n.t('storyShare.card.freeSummary', {
              total: summary.totalLabel,
              start: summary.startLabel,
              end: summary.endLabel,
            })}
          </Text>
        )}
      </View>

      {/* Hour timeline OR empty state */}
      {isFullyBooked ? (
        <View style={todayStyles.emptyWrap}>
          <Text style={[todayStyles.emptyTitle, { color: palette.text }]}>
            {fullyBookedLabel(day.dateKey)}
          </Text>
          <Text style={[todayStyles.emptySubtitle, { color: palette.textMuted }]}>
            {i18n.t('storyShare.card.bookOnlineNextDays')}
          </Text>
        </View>
      ) : (
        <View style={todayStyles.timeline}>
          {twoColumns ? (
            <View style={todayStyles.columns}>
              {[
                hours.slice(0, rowsPerColumn),
                hours.slice(rowsPerColumn),
              ].map((colHours, ci) => (
                <View key={ci} style={todayStyles.column}>
                  {colHours.map((h, i) => (
                    <HourRow
                      key={h}
                      hour={h}
                      isFree={
                        day.freeHalfHours.has(h * 2) ||
                        day.freeHalfHours.has(h * 2 + 1)
                      }
                      first={i === 0}
                      gap={rowGap}
                      maxRowHeight={maxRowHeight}
                      compact
                      palette={palette}
                    />
                  ))}
                </View>
              ))}
            </View>
          ) : (
            hours.map((h, i) => (
              <HourRow
                key={h}
                hour={h}
                isFree={
                  day.freeHalfHours.has(h * 2) ||
                  day.freeHalfHours.has(h * 2 + 1)
                }
                first={i === 0}
                gap={rowGap}
                maxRowHeight={maxRowHeight}
                palette={palette}
              />
            ))
          )}
        </View>
      )}

      {/* Footer — branding only, no emoji per design */}
      <View style={todayStyles.footer}>
        <Text style={[todayStyles.footerLink, { color: palette.footerText }]}>
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
        end={{ x: 0.5, y: 1 }}
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

/**
 * Single timeline row — hour label + busy/free rectangle. Extracted
 * so the single-column and two-column code paths render identically.
 *
 * `compact` shrinks the hour label width + the "Libre" caption font
 * size for the narrower cells in two-column mode.
 */
function HourRow({
  hour,
  isFree,
  first,
  gap,
  maxRowHeight,
  compact = false,
  palette,
}: {
  hour: number;
  isFree: boolean;
  first: boolean;
  gap: number;
  maxRowHeight: number;
  compact?: boolean;
  palette: ThemePalette;
}) {
  return (
    <View
      style={[
        todayStyles.row,
        // flex:1 + maxHeight → rows divide the timeline (flex:1) evenly
        // and shrink to fit when the range is long, so the last hour is
        // never clipped. minHeight:0 lets them shrink below content size.
        { flex: 1, minHeight: 0, maxHeight: maxRowHeight, marginTop: first ? 0 : gap },
      ]}
    >
      <Text
        style={[
          compact ? todayStyles.hourLabelCompact : todayStyles.hourLabel,
          {
            color: isFree ? palette.text : palette.textMuted,
            fontWeight: isFree ? '700' : '500',
          },
        ]}
      >
        {hour}h
      </Text>
      <View
        style={[
          todayStyles.cell,
          {
            alignSelf: 'stretch',
            backgroundColor: isFree ? palette.cellFree : palette.cellBusy,
            paddingHorizontal: compact ? 6 : 10,
          },
        ]}
      >
        {isFree && (
          <Text
            style={[
              todayStyles.cellLabel,
              compact && { fontSize: 10 },
            ]}
            numberOfLines={1}
          >
            {i18n.t('storyShare.card.free')}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Helpers for the day timeline layout ─────────────────────────────────

interface ParsedDate {
  year: number;
  month: number;
  day: number;
  dow: number;
}

/** Parse a YYYY-MM-DD into its parts + computed day-of-week (0=Sun..6=Sat). */
function parseDateKey(dateKey: string): ParsedDate {
  const [y, m, d] = dateKey.split('-').map(Number);
  return {
    year: y,
    month: m - 1,
    day: d,
    dow: new Date(y, m - 1, d).getDay(),
  };
}

function clamp(min: number, max: number, v: number): number {
  return Math.max(min, Math.min(max, v));
}

/** First open hour of the day (smallest bucket // 2). Returns null
 *  when the day has zero free buckets so the caller can fall back. */
function computeMinHour(day: AvailabilityDay): number | null {
  if (day.freeHalfHours.size === 0) return null;
  let min = Infinity;
  for (const b of day.freeHalfHours) min = Math.min(min, Math.floor(b / 2));
  return min === Infinity ? null : Math.max(0, min - 1);
}

/** Last open hour of the day. */
function computeMaxHour(day: AvailabilityDay): number | null {
  if (day.freeHalfHours.size === 0) return null;
  let max = -1;
  for (const b of day.freeHalfHours) max = Math.max(max, Math.floor(b / 2));
  return max < 0 ? null : Math.min(23, max + 1);
}

/**
 * Summarise the day's free time as a one-liner above the timeline.
 *
 * Returns:
 *   - `totalLabel` like "3h", "3h30", "30min" (sum of all free buckets)
 *   - `startLabel` / `endLabel` like "12h" / "20h" (smallest → largest
 *     free bucket, end inclusive — the last bucket is 30 min wide);
 *     assembled by the caller via the storyShare.card.freeSummary key.
 *
 * Returns `null` when the day has no free time so the caller can
 * fall back to the empty-state UI without a misleading "0min libres".
 */
function summarizeFreeWindow(
  day: AvailabilityDay,
): { totalLabel: string; startLabel: string; endLabel: string } | null {
  if (day.freeHalfHours.size === 0) return null;

  // Total time across every free 30-minute bucket.
  const totalMinutes = day.freeHalfHours.size * 30;
  const tH = Math.floor(totalMinutes / 60);
  const tM = totalMinutes % 60;
  const totalLabel =
    tH === 0
      ? `${tM}min`
      : tM === 0
        ? `${tH}h`
        : `${tH}h${tM.toString().padStart(2, '0')}`;

  // Window endpoints. min = first free bucket; max = last free bucket
  // (its end is +30 min). e.g. buckets 24–39 → 12h00 → 20h00.
  let minBucket = Infinity;
  let maxBucket = -1;
  for (const b of day.freeHalfHours) {
    if (b < minBucket) minBucket = b;
    if (b > maxBucket) maxBucket = b;
  }
  const startH = Math.floor(minBucket / 2);
  const startM = (minBucket % 2) * 30;
  const endBucket = maxBucket + 1; // bucket end = next bucket start
  const endH = Math.floor(endBucket / 2);
  const endM = (endBucket % 2) * 30;
  const fmt = (h: number, m: number) =>
    m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, '0')}`;

  return {
    totalLabel,
    startLabel: fmt(startH, startM),
    endLabel: fmt(endH, endM),
  };
}

const todayStyles = StyleSheet.create({
  // Top bar — round avatar (reused from availStoryStyles) on the
  // left + ALL-CAPS caption on the right.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  captionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.7,
  },

  // Compact date block — single-line headline ("Jeudi 7 mai") with
  // capitalised weekday + lowercase month, followed by a free-window
  // summary ("3h libres entre 12h et 20h"). Heights here are reflected
  // verbatim in TIMELINE_AVAILABLE_HEIGHT, keep both in sync.
  dateBlock: {
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 6,
    opacity: 0.85,
  },

  // Hour-by-hour timeline. `overflow: hidden` is a safety net so a
  // computed row height that ends up slightly off doesn't bleed
  // rows past the canvas onto the footer.
  timeline: {
    flex: 1,
    overflow: 'hidden',
  },
  // Two-column wrapper for long opening ranges (>14 hours). Inner
  // columns split the hours half-and-half.
  columns: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  column: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourLabel: {
    width: 32,
    fontSize: 12,
    textAlign: 'left',
    marginRight: 6,
    fontVariant: ['tabular-nums'],
  },
  hourLabelCompact: {
    width: 26,
    fontSize: 11,
    textAlign: 'left',
    marginRight: 4,
    fontVariant: ['tabular-nums'],
  },
  cell: {
    flex: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  cellLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Empty state — kept minimalist (no emoji per design)
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 12,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

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

  // Big title — owns the gap to the day-header row directly
  // (used to be provided by the now-removed dateRange).
  bigTitle: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -0.5,
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

  // Grid body — rows have an explicit height (computed in the
  // layout component) so the hour label gets enough room to
  // render fully. Without this the previous flex:1 + aspectRatio
  // combo squeezed each row to ~17 px on a 14-hour window and
  // labels got clipped.
  gridBody: {
    marginTop: 4,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourLabel: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
  },
  cellWrap: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  cell: {
    width: '100%',
    height: '100%',
    borderRadius: 5,
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

// ─── Month availability story (per-day status grid) ─────────────────────────

export interface MonthAvailabilityDay {
  dateKey: string;
  dayOfMonth: number;
  inMonth: boolean;
  /** 'none' = past / outside the booking horizon → no dot. */
  status: 'available' | 'almost_full' | 'full' | 'closed' | 'none';
}

export interface MonthAvailabilityGrid {
  /** "Juin 2026". */
  monthLabel: string;
  /** Prestation name, or null for the general (service-agnostic) view. */
  serviceLabel: string | null;
  /** Exactly 42 cells (6 weeks, Monday-first). */
  days: MonthAvailabilityDay[];
}

const MONTH_DOT: Record<string, string> = {
  available: '#10b981',
  almost_full: '#f59e0b',
  full: '#f43f5e',
};

/** Full-canvas month availability story — a per-day status calendar that
 *  mirrors the in-app month view, branded for sharing. */
function MonthAvailabilityStoryLayout({
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
  grid: MonthAvailabilityGrid;
  theme: AvailabilityTheme;
}) {
  const palette = theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
  const initials =
    businessName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || 'O';
  // Narrow weekday initials, Monday-first, localized via Intl
  // ("L M M J V S D" in fr, "M T W T F S S" in en). 2021-01-04 is a Monday.
  const WEEK = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow' }).format(
      new Date(2021, 0, 4 + i),
    ),
  );

  const inner = (
    <>
      <View style={[availStoryStyles.decorCircle, { backgroundColor: palette.decor }]} />

      {/* Header */}
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
          <Text style={[availStoryStyles.bizName, { color: palette.text }]} numberOfLines={1}>
            {businessName.toUpperCase()}
          </Text>
          <Text style={[availStoryStyles.bizSubtitle, { color: palette.textMuted }]} numberOfLines={1}>
            {[category, city].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      {/* Title */}
      <Text style={[availStoryStyles.bigTitle, { color: palette.text }]}>
        {i18n.t('storyShare.card.monthTitle')}
      </Text>
      <Text style={[monthStoryStyles.subtitle, { color: palette.text }]} numberOfLines={1}>
        {grid.monthLabel}
        {grid.serviceLabel ? `  ·  ${grid.serviceLabel}` : ''}
      </Text>

      {/* Weekday headers */}
      <View style={monthStoryStyles.weekRow}>
        {WEEK.map((w, i) => (
          <View key={i} style={monthStoryStyles.weekCell}>
            <Text style={[monthStoryStyles.weekText, { color: palette.textMuted }]}>{w}</Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      <View style={monthStoryStyles.grid}>
        {grid.days.map((d, i) => {
          const dot =
            d.status === 'available' || d.status === 'almost_full' || d.status === 'full'
              ? MONTH_DOT[d.status]
              : null;
          return (
            <View key={i} style={[monthStoryStyles.cell, { opacity: d.inMonth ? 1 : 0.28 }]}>
              <Text style={[monthStoryStyles.dayNum, { color: palette.text }]}>{d.dayOfMonth}</Text>
              {dot ? (
                <View style={[monthStoryStyles.dot, { backgroundColor: dot }]} />
              ) : (
                <View style={monthStoryStyles.dotPlaceholder} />
              )}
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={monthStoryStyles.legend}>
        {([
          ['#10b981', i18n.t('storyShare.card.available')],
          ['#f59e0b', i18n.t('storyShare.card.almostFull')],
          ['#f43f5e', i18n.t('storyShare.card.full')],
        ] as [string, string][]).map(([c, l], i) => (
          <View key={i} style={monthStoryStyles.legendItem}>
            <View style={[monthStoryStyles.legendDot, { backgroundColor: c }]} />
            <Text style={[monthStoryStyles.legendText, { color: palette.text }]}>{l}</Text>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={availStoryStyles.footer}>
        <Text style={[availStoryStyles.footerText, { color: palette.footerText }]}>opatam.com</Text>
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
  return <View style={[availStoryStyles.canvas, { backgroundColor: palette.bg }]}>{inner}</View>;
}

const monthStoryStyles = StyleSheet.create({
  subtitle: { fontSize: 15, fontWeight: '700', marginTop: -8, marginBottom: 16 },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekCell: { flex: 1, alignItems: 'center' },
  weekText: { fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dayNum: { fontSize: 15, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotPlaceholder: { width: 8, height: 8 },
  legend: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 14, marginTop: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 4.5 },
  legendText: { fontSize: 11, fontWeight: '600' },
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

// ─── Story « avis » ───────────────────────────────────────────────────────
//
// Direction arrêtée le 2026-08-20 : l'identité est celle d'OPATAM, pas celle
// du salon. Dégradé bleu de marque, accents dorés, carte blanche.
//
// C'est un renversement par rapport à la première version, qui tirait ses
// couleurs de la gamme du prestataire. La raison est commerciale : ces images
// circulent sur les comptes des salons, et c'est l'occasion de faire
// connaître Opatam. Une story reconnaissable au premier coup d'œil vaut mieux
// qu'une story assortie au salon qui la publie — celui-ci est déjà identifié
// par son logo, son nom et son adresse.
//
// PAS DE BOUTON, malgré la maquette : une story est une image, rien n'y est
// cliquable. Dessiner un bouton promettrait une action impossible. Une phrase
// et l'adresse disent la même chose sans mentir sur ce qu'on peut faire.

/** Bleu de marque — exactement celui de l'icône de l'application. */
const OPATAM_BLEU = '#133b8f';
/** Doré des accents : étoiles, filet, étiquette d'en-tête. */
const OPATAM_OR = '#f6c445';

/** Le monogramme blanc, empaqueté avec l'application. */
const LOGO_BLANC = require('../../assets/splash-icon-white.png');
/** Sa contrepartie sur fond clair : le monogramme blanc y disparaîtrait. */
const LOGO_BLEU = require('../../assets/icon.png');

interface ReviewStoryLayoutProps {
  businessName: string;
  category: string;
  city?: string;
  photoURL?: string | null;
  bookingUrl: string;
  review?: StoryReview | null;
  ratingAverage?: number;
  ratingCount?: number;
  theme: StoryTheme;
}

function ReviewStoryLayout({
  businessName,
  category,
  city,
  photoURL,
  bookingUrl,
  review,
  ratingAverage,
  ratingCount,
  theme,
}: ReviewStoryLayoutProps) {
  const pal = theme === 'light' ? BRAND_LIGHT : BRAND_DARK;
  // Sur la note d'ensemble, les étoiles suivent la MOYENNE. Figées à cinq,
  // elles auraient affiché une note parfaite à un salon noté 3,2.
  const noteAffichee = review ? review.rating : (ratingAverage ?? 5);
  const etoiles = Math.max(1, Math.min(5, Math.round(noteAffichee)));
  const commentaire = review?.comment?.trim() || null;
  const sousTitre = [getCategoryLabel(category), city].filter(Boolean).join(' — ');
  // « https://opatam.com/p/x » → « opatam.com/p/x » : le protocole ne dit rien
  // à personne et mange de la place sur une ligne déjà étroite.
  const adresse = bookingUrl.replace(/^https?:\/\//, '');

  return (
    <LinearGradient
      colors={pal.gradient}
      locations={[0, 0.58, 1]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={reviewStyles.canvas}
    >
      {/* En-tête de marque */}
      <View style={reviewStyles.header}>
        <View style={reviewStyles.brand}>
          <Image
            source={theme === 'light' ? LOGO_BLEU : LOGO_BLANC}
            style={reviewStyles.brandMark}
            resizeMode="contain"
          />
          <Text style={[reviewStyles.brandName, { color: pal.wordmark }]}>OPATAM</Text>
        </View>
        <Text style={[reviewStyles.badge, { color: pal.eyebrow }]}>
          {i18n.t('storyShare.review.badge')}
        </Text>
      </View>

      <View style={reviewStyles.middle}>
        <View style={reviewStyles.cardWrap}>
          {/*
            La photo du SALON, à cheval sur le bord de la carte. Jamais celle
            de la cliente : un avis public sur une page et un visage poussé à
            des milliers d'abonnés ne relèvent pas du même consentement.

            Deux anneaux, comme sur la story fidélité : blanc opaque puis le
            trait de couleur. L'avatar chevauchant deux fonds, un liseré
            translucide n'aurait été visible que sur sa moitié haute.
          */}
          <View style={[reviewStyles.avatarRing, { borderColor: pal.eyebrow }]}>
            <View style={reviewStyles.avatar}>
              {/*
                L'initiale est TOUJOURS rendue, la photo par-dessus.
                Elle servait de remplacement quand aucune photo n'existe ;
                elle sert maintenant aussi de fond pendant que la photo
                descend. Sans elle, un salon dont l'image n'est pas encore en
                cache montrait un disque vide au milieu de la story — et une
                capture prise à cet instant l'aurait figé ainsi.
              */}
              <View style={reviewStyles.avatarFallback}>
                <Text style={reviewStyles.avatarInitial}>
                  {businessName.charAt(0).toUpperCase()}
                </Text>
              </View>
              {photoURL ? (
                <Image
                  source={{ uri: photoURL }}
                  style={[StyleSheet.absoluteFill, reviewStyles.avatarImg]}
                />
              ) : null}
            </View>
          </View>

          <View style={reviewStyles.card}>
            <Text style={reviewStyles.business} numberOfLines={2}>
              {businessName}
            </Text>
            {sousTitre ? <Text style={reviewStyles.subtitle}>{sousTitre}</Text> : null}

            <Text style={reviewStyles.stars}>{'★'.repeat(etoiles)}</Text>
            <Text style={reviewStyles.note}>
              {noteAffichee.toLocaleString(i18n.language, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              {' / 5'}
            </Text>

            <View style={reviewStyles.filet} />

            {commentaire ? (
              /*
                PLAFOND DUR sur le nombre de lignes.
                La toile fait 640 de haut et déborde en `overflow: hidden` :
                une citation longue faisait grandir la carte, poussait le pied
                de story hors du cadre et se faisait couper à la capture. La
                troncature à 220 caractères rend le cas rare ; ce plafond le
                rend impossible.
              */
              <Text style={reviewStyles.quote} numberOfLines={7} ellipsizeMode="tail">
                {`« ${commentaire} »`}
              </Text>
            ) : (ratingCount ?? 0) > 0 ? (
              /**
               * Un avis 5★ sur deux n'a AUCUN texte. Ce n'est pas un cas
               * dégradé mais le cas courant : à défaut de citation, on montre
               * ce qui reste vrai — sur combien d'avis repose cette note.
               */
              <Text style={reviewStyles.quote}>
                {i18n.t('storyShare.review.outOf', { count: ratingCount ?? 0 })}
              </Text>
            ) : null}

            {review?.authorName ? (
              <Text style={reviewStyles.author}>
                {`— ${review.authorName}`}
                {review.verified ? `, ${i18n.t('storyShare.review.verified')}` : ''}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Appel à l'action, en TEXTE : rien n'est cliquable dans une image. */}
      <View style={reviewStyles.footer}>
        <Text style={[reviewStyles.cta, { color: pal.footText }]}>
          {i18n.t('storyShare.review.bookAt', { name: businessName })}
        </Text>
        <Text style={[reviewStyles.url, { color: pal.footUrl }]}>{adresse}</Text>
      </View>
    </LinearGradient>
  );
}

// ─── Story « fidélité » ───────────────────────────────────────────────────
//
// Transposition du gabarit HTML fourni par le client (docs/), à l'échelle
// 1/3 — la référence est dessinée en 1080 de large, la carte est rendue en
// 360 puis capturée en 1080.
//
// CE QUI FAIT LE CARACTÈRE, et qu'une version sobre perdait : un vrai ticket
// cartonné. Fond ivoire rayé, bordure pointillée, encoches latérales, tampons
// à l'encre POSÉS DE TRAVERS, et un sceau cranté pour la récompense. Sans ces
// détails l'objet redevient un encadré, et un encadré ne donne envie à
// personne.
//
// Les cases cochées sont ILLUSTRATIVES et assumées comme telles : elles
// montrent comment la carte se remplit. Une carte vierge se lit comme une
// grille inerte.

/** Le sceau cranté de la récompense. Dégradé impossible en SVG simple : on
 *  s'en tient à la découpe, qui est ce qui se remarque. */
function SceauCrante({ taille, couleur }: { taille: number; couleur: string }) {
  if (!Svg || !SvgPolygon) return null;
  const r = taille / 2;
  const dents = 12;
  const points: string[] = [];
  for (let i = 0; i < dents * 2; i++) {
    const rayon = i % 2 === 0 ? r : r * 0.84;
    const angle = (Math.PI * i) / dents - Math.PI / 2;
    points.push(`${r + rayon * Math.cos(angle)},${r + rayon * Math.sin(angle)}`);
  }
  return (
    <Svg width={taille} height={taille} style={StyleSheet.absoluteFill}>
      <SvgPolygon points={points.join(' ')} fill={couleur} />
    </Svg>
  );
}

interface LoyaltyStoryLayoutProps {
  businessName: string;
  category: string;
  city?: string;
  photoURL?: string | null;
  bookingUrl: string;
  loyalty: StoryLoyalty;
  theme: StoryTheme;
}

function LoyaltyStoryLayout({
  businessName,
  category,
  city,
  photoURL,
  bookingUrl,
  loyalty,
  theme,
}: LoyaltyStoryLayoutProps) {
  const pal = theme === 'light' ? BRAND_LIGHT : BRAND_DARK;
  const sousTitre = [getCategoryLabel(category), city].filter(Boolean).join(' — ');
  const adresse = bookingUrl.replace(/^https?:\/\//, '');

  // `seuil - 1` cases numérotées, puis la case récompense. Au-delà de dix,
  // les tampons deviendraient illisibles : on montre alors la récompense
  // seule, sans dessiner chaque rendez-vous.
  const grilleLisible = loyalty.threshold >= 2 && loyalty.threshold <= 10;
  const parRangee = loyalty.threshold <= 5 ? loyalty.threshold : Math.ceil(loyalty.threshold / 2);
  const tailleTampon = Math.min(37, Math.floor((262 - (parRangee - 1) * 7) / parRangee));
  // Deux tampons apposés : assez pour montrer l'usage, pas assez pour laisser
  // croire à la lectrice que ce sont les siens.
  const remplis = Math.min(2, Math.max(0, loyalty.threshold - 1));

  return (
    /*
      Un dégradé FRANC, sans halo. La référence pose un `radial-gradient` par
      dessus ; faute de dégradé radial en React Native, je l'avais approché
      par des anneaux concentriques — et cinq cercles d'opacité fixe ne font
      pas un dégradé, ils font cinq paliers bien visibles. Mieux vaut une
      transition propre qu'une imitation ratée.
    */
    <LinearGradient
      colors={pal.gradient}
      locations={[0, 0.58, 1]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={loyaltyStyles.canvas}
    >

      <View style={loyaltyStyles.head}>
        <View style={loyaltyStyles.brand}>
          <Image
            source={theme === 'light' ? LOGO_BLEU : LOGO_BLANC}
            style={loyaltyStyles.brandMark}
            resizeMode="contain"
          />
          <Text style={[loyaltyStyles.wordmark, { color: pal.wordmark }]}>OPATAM</Text>
        </View>
        <Text style={[loyaltyStyles.eyebrow, { color: pal.eyebrow }]}>
          {i18n.t('storyShare.loyalty.badge')}
        </Text>
      </View>

      <View style={loyaltyStyles.stage}>
        <View style={loyaltyStyles.hook}>
          <Text
            style={[loyaltyStyles.hookTitle, { color: pal.wordmark }]}
            numberOfLines={3}
          >
            {i18n.t('storyShare.loyalty.headline', { count: loyalty.threshold })}
            {'\n'}
            <Text style={{ color: pal.eyebrow }}>
              {i18n.t('storyShare.loyalty.headlineReward', { reward: loyalty.reward })}
            </Text>
          </Text>
        </View>

        {/* La place de l'avatar est RÉSERVÉE par le conteneur, comme sur la
            story d'avis : il déborde de 42 px vers le haut, et sans cette
            réserve il mordrait sur le sous-titre au lieu de flotter. */}
        <View style={loyaltyStyles.cardWrap}>
        <View style={loyaltyStyles.card}>
          {/* Même anneau que sur la story d'avis : blanc opaque, puis le
              trait de couleur — l'avatar étant à cheval sur deux fonds, un
              liseré translucide n'aurait été visible qu'à moitié. */}
          <View style={[loyaltyStyles.avatarRing, { borderColor: pal.eyebrow }]}>
            <View style={loyaltyStyles.avatar}>
              {/* Même principe que sur la story d'avis : l'initiale tient la
                  place, la photo se pose dessus quand elle arrive. */}
              <View style={loyaltyStyles.avatarFallback}>
                <Text style={loyaltyStyles.avatarInitial}>
                  {businessName.charAt(0).toUpperCase()}
                </Text>
              </View>
              {photoURL ? (
                <Image
                  source={{ uri: photoURL }}
                  style={[StyleSheet.absoluteFill, loyaltyStyles.avatarImg]}
                />
              ) : null}
            </View>
          </View>

          <Text style={loyaltyStyles.enseigne} numberOfLines={2}>
            {businessName}
          </Text>
          {sousTitre ? <Text style={loyaltyStyles.meta}>{sousTitre}</Text> : null}

          {/* ── Le ticket ── */}
          <View style={loyaltyStyles.ticketWrap}>
            <View style={loyaltyStyles.ticket}>
              {/* Rayures verticales du carton. */}
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                {Array.from({ length: 60 }).map((_, i) => (
                  <View
                    key={i}
                    style={{
                      position: 'absolute',
                      left: i * 5,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      backgroundColor: 'rgba(27,47,110,0.022)',
                    }}
                  />
                ))}
              </View>

              <View style={loyaltyStyles.ticketHead}>
                <Text style={loyaltyStyles.ticketTitre}>
                  {i18n.t('storyShare.loyalty.cardLabel')}
                </Text>
                <View style={loyaltyStyles.ticketGain}>
                  <Text style={loyaltyStyles.ticketGainText}>
                    {i18n.t('storyShare.loyalty.count', { count: loyalty.threshold })}
                  </Text>
                </View>
              </View>

              <View style={loyaltyStyles.tampons}>
                {grilleLisible ? (
                  <>
                    {Array.from({ length: loyalty.threshold - 1 }).map((_, i) => {
                      const pose = i < remplis;
                      const dim = {
                        width: tailleTampon,
                        height: tailleTampon,
                        borderRadius: tailleTampon / 2,
                      };
                      return pose ? (
                        <View
                          key={i}
                          style={[
                            loyaltyStyles.tamponPlein,
                            dim,
                            // Un tampon se pose de travers. Alterner les
                            // angles évite l'alignement mécanique qui trahit
                            // le dessin.
                            { transform: [{ rotate: i % 2 === 0 ? '-9deg' : '7deg' }] },
                          ]}
                        >
                          <View
                            style={[
                              loyaltyStyles.tamponAnneau,
                              { borderRadius: tailleTampon / 2 },
                            ]}
                          />
                          <Ionicons
                            name="checkmark"
                            size={Math.round(tailleTampon * 0.42)}
                            color={LOYAL_BLEU}
                          />
                        </View>
                      ) : (
                        <View key={i} style={[loyaltyStyles.tampon, dim]}>
                          <Text
                            style={[
                              loyaltyStyles.tamponNum,
                              { fontSize: Math.round(tailleTampon * 0.29) },
                            ]}
                          >
                            {i + 1}
                          </Text>
                        </View>
                      );
                    })}
                    <View
                      style={[
                        loyaltyStyles.tamponRecompense,
                        { width: tailleTampon, height: tailleTampon },
                      ]}
                    >
                      <SceauCrante taille={tailleTampon} couleur={LOYAL_OR} />
                      {!Svg && (
                        <View
                          style={{
                            ...StyleSheet.absoluteFillObject,
                            borderRadius: tailleTampon / 2,
                            backgroundColor: LOYAL_OR,
                          }}
                        />
                      )}
                      <Text
                        style={[
                          loyaltyStyles.tamponRecompenseText,
                          { fontSize: Math.round(tailleTampon * 0.27) },
                        ]}
                      >
                        {loyalty.reward}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={loyaltyStyles.recompenseLarge}>
                    <Text style={loyaltyStyles.recompenseLargeText}>{loyalty.reward}</Text>
                  </View>
                )}
              </View>

              <View style={loyaltyStyles.ticketPied}>
                <View style={loyaltyStyles.puce} />
                <Text style={loyaltyStyles.ticketPiedText} numberOfLines={2}>
                  {loyalty.excluded.length > 0
                    ? i18n.t('storyShare.loyalty.except', { list: loyalty.excluded.join(', ') })
                    : i18n.t('storyShare.loyalty.allServices')}
                </Text>
              </View>
            </View>

            {/* Encoches : le repère visuel du ticket. */}
            <View style={[loyaltyStyles.encoche, loyaltyStyles.encocheG]} />
            <View style={[loyaltyStyles.encoche, loyaltyStyles.encocheD]} />
          </View>

          <Text style={loyaltyStyles.detail}>{i18n.t('storyShare.loyalty.automatic')}</Text>
        </View>
        </View>

        {/* Pas de pastille : rien n'est cliquable dans une image, et un
            bouton dessiné promet une action impossible. */}
        <View style={loyaltyStyles.foot}>
          <Text style={[loyaltyStyles.ctaText, { color: pal.footText }]}>
            {i18n.t('storyShare.review.bookAt', { name: businessName })}
          </Text>
          <Text style={[loyaltyStyles.url, { color: pal.footUrl }]}>{adresse}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

/**
 * Les deux ambiances des stories de marque.
 *
 * LA CARTE BLANCHE NE CHANGE PAS d'un mode à l'autre : seuls la toile, l'en-
 * tête et le pied basculent. C'est ce qui rend le mode clair tenable sans
 * redessiner chaque élément — et ce qui garde les deux versions
 * reconnaissables comme la même story.
 *
 * L'or ne tient pas sur fond clair : il y devient illisible. Le mode clair
 * lui substitue un ambre profond, qui garde l'intention sans le contraste
 * raté.
 */
interface StoryBrandPalette {
  gradient: [string, string, string];
  wordmark: string;
  eyebrow: string;
  footText: string;
  footUrl: string;
}

const BRAND_DARK: StoryBrandPalette = {
  gradient: ['#2A4AA5', '#1B2F6E', '#152551'],
  wordmark: '#FFFFFF',
  eyebrow: '#F4C928',
  footText: '#FFFFFF',
  footUrl: 'rgba(255,255,255,0.8)',
};

const BRAND_LIGHT: StoryBrandPalette = {
  gradient: ['#FFFFFF', '#F1F4FB', '#E3E9F6'],
  wordmark: '#1B2F6E',
  eyebrow: '#A8811E',
  footText: '#1B2F6E',
  footUrl: 'rgba(27,47,110,0.7)',
};

const LOYAL_BLEU = '#1B2F6E';
const LOYAL_OR = '#F4C928';
const LOYAL_GRIS = '#6B7793';

const loyaltyStyles = StyleSheet.create({
  canvas: { flex: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  // `icon.png` est le carré bleu de l'icône, pas un monogramme détouré :
  // sans rayon, il pose un rectangle net sur le fond clair.
  brandMark: { width: 19, height: 19, borderRadius: 4.5 },
  wordmark: { fontSize: 13, fontWeight: '800', letterSpacing: 1.7 },
  eyebrow: { fontSize: 7.5, fontWeight: '800', letterSpacing: 2.5 },

  stage: { flex: 1, justifyContent: 'center' },
  // L'accroche collait à l'en-tête : sur une story, le haut de l'image est
  // souvent recouvert par l'interface du réseau, et un titre qui y monte se
  // fait manger.
  hook: { alignItems: 'center', marginTop: 26, marginBottom: 18 },
  cardWrap: { alignItems: 'center', paddingTop: 47 },
  hookTitle: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },

  /**
   * Identique à la carte de la story d'avis — mêmes rayon, marges et
   * absence d'ombre.
   *
   * Elle portait une ombre portée profonde, reprise de la référence HTML où
   * elle se détache sur un fond bleu. Sur le fond CLAIR elle devenait une
   * tache grise sous un rectangle blanc, alors que la carte des avis, elle,
   * posait proprement. Deux cartes de la même famille n'ont pas à se traiter
   * différemment.
   */
  card: {
    // 93 % et non 100 % : cette carte porte un titre au-dessus et bien plus
    // de contenu que celle des avis. À pleine largeur, elle touchait les
    // bords et l'accroche semblait posée dessus.
    width: '93%',
    backgroundColor: '#ffffff',
    borderRadius: 26,
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 22,
    alignItems: 'center',
  },
  avatarRing: {
    position: 'absolute',
    top: -47,
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 2,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#dfe4f2',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: LOYAL_BLEU,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 28, fontWeight: '800' },

  enseigne: {
    color: LOYAL_BLEU,
    fontSize: 21,
    lineHeight: 23,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  meta: { marginTop: 4, color: LOYAL_GRIS, fontSize: 9.5, fontWeight: '500' },

  ticketWrap: { width: '100%', marginTop: 12, marginHorizontal: -5, position: 'relative' },
  ticket: {
    paddingTop: 11,
    paddingHorizontal: 13,
    paddingBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C6CEE2',
    backgroundColor: '#F8F4E6',
    overflow: 'hidden',
  },
  encoche: {
    position: 'absolute',
    top: '50%',
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#fff',
    marginTop: -9,
  },
  encocheG: { left: -9 },
  encocheD: { right: -9 },

  ticketHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: '#D6DCEA',
  },
  ticketTitre: {
    color: LOYAL_BLEU,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  ticketGain: {
    backgroundColor: LOYAL_OR,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  ticketGainText: { color: LOYAL_BLEU, fontSize: 9, fontWeight: '800' },

  tampons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
    marginTop: 10,
  },
  tampon: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#BFC8DD',
    backgroundColor: 'rgba(255,255,255,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tamponNum: { color: '#A6AFC6', fontWeight: '700' },
  tamponPlein: {
    borderWidth: 1.7,
    borderColor: LOYAL_BLEU,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.94,
  },
  tamponAnneau: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderWidth: 0.8,
    borderColor: 'rgba(27,47,110,0.45)',
  },
  tamponRecompense: { alignItems: 'center', justifyContent: 'center' },
  tamponRecompenseText: { color: LOYAL_BLEU, fontWeight: '800' },
  recompenseLarge: {
    backgroundColor: LOYAL_OR,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  recompenseLargeText: { color: LOYAL_BLEU, fontSize: 14, fontWeight: '800' },

  ticketPied: {
    marginTop: 10,
    paddingTop: 7,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: '#D6DCEA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  puce: { width: 3, height: 3, borderRadius: 2, backgroundColor: LOYAL_OR },
  ticketPiedText: { color: '#7C87A0', fontSize: 8, fontWeight: '600', flexShrink: 1 },

  detail: {
    marginTop: 11,
    color: LOYAL_GRIS,
    fontSize: 8.7,
    lineHeight: 12.5,
    fontWeight: '500',
    textAlign: 'center',
  },

  foot: { alignItems: 'center', paddingTop: 20 },
  ctaText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  url: {
    marginTop: 6,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

const reviewStyles = StyleSheet.create({
  canvas: { flex: 1, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: { width: 26, height: 26, borderRadius: 6 },
  brandName: { fontSize: 15, fontWeight: '800', letterSpacing: 2.5 },
  badge: { fontSize: 10, fontWeight: '700', letterSpacing: 2 },

  middle: { flex: 1, justifyContent: 'center' },
  cardWrap: { alignItems: 'center', paddingTop: 47 },
  avatarRing: {
    position: 'absolute',
    top: 0,
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 2,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: OPATAM_BLEU,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#ffffff', fontSize: 30, fontWeight: '800' },

  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 26,
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 26,
    alignItems: 'center',
  },
  business: {
    color: OPATAM_BLEU,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: { color: '#7b8390', fontSize: 12.5, marginTop: 4, textAlign: 'center' },
  stars: { color: OPATAM_OR, fontSize: 26, letterSpacing: 4, marginTop: 14 },
  note: { color: OPATAM_BLEU, fontSize: 13, fontWeight: '800', marginTop: 6 },
  filet: {
    width: 38,
    height: 3,
    borderRadius: 2,
    backgroundColor: OPATAM_OR,
    marginVertical: 16,
  },
  quote: {
    color: '#2f3437',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  author: { color: '#9aa0a8', fontSize: 12, marginTop: 14, textAlign: 'center' },

  footer: { alignItems: 'center', gap: 5, paddingTop: 18 },
  cta: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  url: { fontSize: 12 },
});

export function StoryCard({
  businessName,
  category,
  city,
  photoURL,
  services,
  bookingUrl,
  displayMode = 'services',
  availabilityGrid,
  monthGrid,
  availabilityScope = 'week',
  storyTheme = 'light',
  gradientColors,
  review,
  ratingAverage,
  ratingCount,
  loyalty,
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

  if (displayMode === 'loyalty' && loyalty) {
    return (
      <View style={styles.container}>
        <LoyaltyStoryLayout
          businessName={businessName}
          category={category}
          city={city}
          photoURL={photoURL}
          bookingUrl={bookingUrl}
          loyalty={loyalty}
          theme={storyTheme}
        />
      </View>
    );
  }

  // La story d'avis a sa propre toile, comme les disponibilités : la coque
  // dégradée générique ne saurait pas produire cette composition.
  if (displayMode === 'review') {
    return (
      <View style={styles.container}>
        <ReviewStoryLayout
          businessName={businessName}
          category={category}
          city={city}
          photoURL={photoURL}
          bookingUrl={bookingUrl}
          review={review}
          ratingAverage={ratingAverage}
          ratingCount={ratingCount}
          theme={storyTheme}
        />
      </View>
    );
  }

  // The "availabilities" mode uses a fully custom full-canvas layout
  // (matches the design reference) instead of the generic gradient
  // story shell. Two layouts share the slot — the historical 7-day
  // heatmap and the new today-only list of free time slots. The
  // sub-toggle in the modal controls which one renders.
  if (displayMode === 'availabilities' && availabilityScope === 'month' && monthGrid) {
    return (
      <View style={styles.container}>
        <MonthAvailabilityStoryLayout
          businessName={businessName}
          category={category}
          city={city}
          photoURL={photoURL}
          grid={monthGrid}
          theme={storyTheme}
        />
      </View>
    );
  }

  if (displayMode === 'availabilities' && availabilityGrid && availabilityGrid.days.length > 0) {
    if (availabilityScope === 'day') {
      return (
        <View style={styles.container}>
          <TodayAvailabilityLayout
            businessName={businessName}
            photoURL={photoURL}
            // We pass the FIRST day of the grid — when scope is
            // 'day' the hook fetched a single-day window so this
            // is always today (or the picked day).
            day={availabilityGrid.days[0]}
            theme={storyTheme}
          />
        </View>
      );
    }
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
                {i18n.t('storyShare.card.ourServices')}
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
                    {service.price === 0 ? i18n.t('common.free') : `${(service.price / 100).toFixed(0)}€`}
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
                {i18n.t('storyShare.card.scanToBook')}
              </Text>
            </View>
          )}

          {/* Branding */}
          <View style={styles.brandingSection}>
            <View style={[styles.brandingDivider, { backgroundColor: palette.brandingDivider }]} />
            <View style={styles.brandingCenter}>
              {/*
                Le logo EMPAQUETÉ, pas celui de Firebase Storage.
                `ASSETS.logos.default` est une URL distante : l'aperçu
                s'ouvrait sur un trou à l'emplacement du logo, le temps d'un
                aller-retour réseau — pour une image qui voyage déjà avec
                l'application. Et une capture déclenchée avant son arrivée
                aurait produit une story sans marque.
              */}
              <Image
                source={LOGO_BLEU}
                style={[styles.brandingLogo, { borderRadius: 5 }]}
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
