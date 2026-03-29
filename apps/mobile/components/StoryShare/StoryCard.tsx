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

import React, { useMemo } from 'react';
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

export interface DayScheduleItem {
  day: string;
  isOpen: boolean;
  slots: { start: string; end: string }[];
}

export interface StoryCardProps {
  businessName: string;
  category: string;
  city?: string;
  photoURL?: string | null;
  services: Array<{ name: string; price: number; duration: number }>;
  bookingUrl: string;
  displayMode?: 'services' | 'hours' | 'none';
  weekSchedule?: DayScheduleItem[];
  gradientColors?: [string, string, string];
}

// Story dimensions (9:16 ratio, scaled down for rendering — captured at high res)
const STORY_WIDTH = 360;
const STORY_HEIGHT = 640;

const SHORT_DAYS: Record<string, string> = {
  Lundi: 'Lun',
  Mardi: 'Mar',
  Mercredi: 'Mer',
  Jeudi: 'Jeu',
  Vendredi: 'Ven',
  Samedi: 'Sam',
  Dimanche: 'Dim',
};

// ─── Hours helpers ───────────────────────────────────────────────────────

/** Sort slots by start time */
function sortSlots(slots: { start: string; end: string }[]) {
  return [...slots].sort((a, b) => {
    const [ah, am] = a.start.split(':').map(Number);
    const [bh, bm] = b.start.split(':').map(Number);
    return ah * 60 + am - (bh * 60 + bm);
  });
}

/** Build a display string for a day's slots */
function formatSlots(slots: { start: string; end: string }[]): string {
  const sorted = sortSlots(slots);
  if (sorted.length <= 2) {
    return sorted.map((s) => `${s.start} – ${s.end}`).join(' / ');
  }
  // >2 slots: show first start and last end
  return `${sorted[0].start} – ${sorted[sorted.length - 1].end}`;
}

interface GroupedHours {
  label: string; // e.g. "Lun – Ven" or "Sam"
  value: string; // e.g. "09:00 – 12:00 / 14:00 – 18:00" or "Fermé"
  isOpen: boolean;
}

/** Group consecutive days with identical hours */
function groupHours(schedule: DayScheduleItem[]): GroupedHours[] {
  if (!schedule.length) return [];

  const dayKey = (d: DayScheduleItem) => {
    if (!d.isOpen) return '__closed__';
    return sortSlots(d.slots).map((s) => `${s.start}-${s.end}`).join(',');
  };

  const groups: GroupedHours[] = [];
  let groupStart = 0;

  for (let i = 1; i <= schedule.length; i++) {
    const sameGroup = i < schedule.length && dayKey(schedule[i]) === dayKey(schedule[groupStart]);
    if (!sameGroup) {
      const first = schedule[groupStart];
      const last = schedule[i - 1];
      const startShort = SHORT_DAYS[first.day] || first.day;
      const endShort = SHORT_DAYS[last.day] || last.day;

      groups.push({
        label: groupStart === i - 1 ? startShort : `${startShort} – ${endShort}`,
        value: first.isOpen ? formatSlots(first.slots) : 'Fermé',
        isOpen: first.isOpen,
      });
      groupStart = i;
    }
  }

  return groups;
}

// ─── Component ───────────────────────────────────────────────────────────

export function StoryCard({
  businessName,
  category,
  city,
  photoURL,
  services,
  bookingUrl,
  displayMode = 'services',
  weekSchedule = [],
  gradientColors = ['#ffffff', '#f0f4f8', '#e2e8f0'],
}: StoryCardProps) {
  const topServices = services.slice(0, 5);
  const subtitle = [category, city].filter(Boolean).join(' • ').toUpperCase();
  const hasContent = displayMode !== 'none' && (
    displayMode === 'services' ? topServices.length > 0 : weekSchedule.length > 0
  );

  const groupedHours = useMemo(
    () => displayMode === 'hours' ? groupHours(weekSchedule) : [],
    [displayMode, weekSchedule],
  );

  // QR code only shown in 'none' mode (renamed "QR Code")
  const showQR = displayMode === 'none';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Decorative circles */}
        <View style={styles.decorCircleTop} />
        <View style={styles.decorCircleBottom} />

        {/* Content */}
        <View style={styles.content}>
          {/* Top spacer */}
          <View style={{ flex: 0.8 }} />

          {/* Avatar */}
          <View style={styles.avatarSection}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>
                  {businessName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Business info */}
          <View style={styles.infoSection}>
            <Text style={styles.businessName} numberOfLines={2}>
              {businessName}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle}>{subtitle}</Text>
            ) : null}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Services */}
          {displayMode === 'services' && topServices.length > 0 && (
            <View style={[styles.cardSection, topServices.length > 3 && styles.cardSectionCompact]}>
              <Text style={[styles.sectionTitle, topServices.length > 3 && { marginBottom: 8 }]}>Nos prestations</Text>
              {topServices.map((service, index) => (
                <View key={index} style={[styles.serviceRow, topServices.length > 3 && { marginBottom: 6 }]}>
                  <View style={styles.serviceDot} />
                  <Text style={[styles.serviceName, topServices.length > 3 && { fontSize: 13 }]} numberOfLines={1}>
                    {service.name}
                  </Text>
                  <View style={styles.serviceLine} />
                  <Text style={[styles.servicePrice, topServices.length > 3 && { fontSize: 14 }]}>
                    {service.price === 0 ? 'Gratuit' : `${(service.price / 100).toFixed(0)}€`}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Hours (grouped) */}
          {displayMode === 'hours' && groupedHours.length > 0 && (
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>Horaires d'ouverture</Text>
              {groupedHours.map((group, index) => (
                <View key={index} style={styles.hourRow}>
                  <Text style={[styles.hourDay, !group.isOpen && styles.hourClosed]}>
                    {group.label}
                  </Text>
                  <View style={styles.hourDotLine} />
                  <Text
                    style={[styles.hourSlots, !group.isOpen && styles.hourClosed]}
                    numberOfLines={1}
                  >
                    {group.value}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* QR Code section — only in QR Code mode */}
          {showQR && (
            <View style={styles.qrSection}>
              <View style={styles.qrContainer}>
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
              <Text style={styles.qrLabel}>Scannez pour réserver</Text>
            </View>
          )}

          {/* Branding */}
          <View style={styles.brandingSection}>
            <View style={styles.brandingDivider} />
            <View style={styles.brandingCenter}>
              <Image
                source={{ uri: ASSETS.logos.default }}
                style={styles.brandingLogo}
                resizeMode="contain"
              />
              <Text style={styles.brandingText}>opatam.com</Text>
            </View>
            <View style={styles.brandingDivider} />
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

  // Hours
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },
  hourDay: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    width: 64,
  },
  hourDotLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 6,
    minWidth: 8,
  },
  hourSlots: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
    textAlign: 'right',
    flexShrink: 0,
  },
  hourClosed: {
    color: '#9ca3af',
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
