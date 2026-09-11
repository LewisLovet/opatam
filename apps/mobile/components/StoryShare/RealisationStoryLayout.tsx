/**
 * Stories « réalisation » et « avant / après » — une photo du travail du
 * salon en plein cadre, un bandeau prestation, et la signature Opatam.
 *
 * Principes (décision client 2026-09-10) :
 *  - la PHOTO est le sujet : elle occupe tout le cadre, le reste se pose
 *    dessus sur des voiles sombres pour rester lisible quelle que soit l'image ;
 *  - Opatam est présent sans crier : le monogramme et le nom en en-tête, la
 *    phrase « Réservez chez … » et l'adresse en pied, comme les stories
 *    avis et fidélité ;
 *  - zones sûres Instagram : l'en-tête commence sous la barre de progression
 *    (~64 px à l'échelle 360×640), le pied s'arrête au-dessus de la zone de
 *    réponse (~88 px). Un bandeau placé hors de ces zones serait masqué ;
 *  - rien n'est stocké : l'image vient du téléphone (ou du portfolio) et
 *    ressort en PNG capturé, comme les autres stories.
 *
 * Rendu à 360×640 puis capturé en 1080×1920 (voir StoryCard).
 */

import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../../lib/i18n';
import { Text } from '../Text';
import { getCategoryLabel } from '@booking-app/shared/constants';
import { CADRAGE_DEFAUT, PhotoCadree, type Cadrage } from './PhotoCadree';

/** Dimensions de la toile (voir StoryCard) et de ses zones photo. */
export const STORY_W = 360;
export const STORY_H = 640;
const DIVIDER_W = 2;
/** Largeur d'une moitié en avant / après. */
export const HALF_W = (STORY_W - DIVIDER_W) / 2;
/** Formats des zones photo, pour l'éditeur de cadrage. */
export const RATIO_PLEIN = STORY_W / STORY_H;
export const RATIO_MOITIE = HALF_W / STORY_H;
/** Hauteur d'une moitié quand l'avant / après est empilé (haut / bas). */
export const HALF_H = (STORY_H - DIVIDER_W) / 2;
export const RATIO_MOITIE_EMPILEE = STORY_W / HALF_H;

/** Ce que la story affiche — déjà mis en forme par l'appelant. */
export interface StoryRealisation {
  /** Photo principale (réalisation) ou photo « après ». `null` = à choisir. */
  photoUri: string | null;
  /** Photo « avant » (mode avant / après uniquement). */
  beforePhotoUri?: string | null;
  /** Cadrage choisi pour chaque photo (position + zoom). */
  photoCadrage?: Cadrage;
  beforeCadrage?: Cadrage;
  /** Prestation illustrée ; `null` = story sans prestation. */
  serviceName: string | null;
  /** « 1h30 » — déjà formaté. */
  durationLabel: string | null;
  /** « 45 € » / « à partir de 45 € » — `null` = prix masqué. */
  priceLabel: string | null;
  /** Prix barré quand une promotion est en cours. */
  priceStrikeLabel?: string | null;
  bannerPosition: 'top' | 'bottom';
  /** Avant / après : côte à côte (défaut) ou empilé haut / bas. */
  splitLayout?: 'sideBySide' | 'stacked';
}

interface RealisationStoryLayoutProps {
  mode: 'realisation' | 'avantApres';
  businessName: string;
  category: string;
  city?: string;
  photoURL?: string | null;
  bookingUrl: string;
  realisation: StoryRealisation;
}

const OPATAM_BLEU = '#133b8f';
const OPATAM_OR = '#f6c445';
const LOGO_BLANC = require('../../assets/splash-icon-white.png');

function PhotoOrPlaceholder({
  uri,
  hint,
  width,
  height,
  cadrage,
}: {
  uri: string | null;
  hint: string;
  width: number;
  height: number;
  cadrage?: Cadrage;
}) {
  if (uri) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <PhotoCadree uri={uri} width={width} height={height} cadrage={cadrage ?? CADRAGE_DEFAUT} />
      </View>
    );
  }
  return (
    <LinearGradient
      colors={['#2A4AA5', '#1B2F6E', '#152551']}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[StyleSheet.absoluteFill, s.placeholder]}
    >
      <Ionicons name="image-outline" size={40} color="rgba(255,255,255,0.7)" />
      <Text style={s.placeholderText}>{hint}</Text>
    </LinearGradient>
  );
}

export function RealisationStoryLayout({
  mode,
  businessName,
  category,
  city,
  photoURL,
  bookingUrl,
  realisation,
}: RealisationStoryLayoutProps) {
  const adresse = bookingUrl.replace(/^https?:\/\//, '');
  const sousTitre = [getCategoryLabel(category), city].filter(Boolean).join(' — ');
  const avantApres = mode === 'avantApres';
  const empile = avantApres && realisation.splitLayout === 'stacked';
  const addPhoto = i18n.t('storyShare.realisation.addPhoto');

  const bandeau = (
    <View style={s.banner}>
      {realisation.serviceName ? (
        <>
          <Text style={s.bannerTitle} numberOfLines={2}>
            {realisation.serviceName}
          </Text>
          {(realisation.durationLabel || realisation.priceLabel) && (
            <View style={s.bannerMeta}>
              {realisation.durationLabel ? (
                <View style={s.bannerMetaItem}>
                  <Ionicons name="time-outline" size={13} color="#7b8390" />
                  <Text style={s.bannerMetaText}>{realisation.durationLabel}</Text>
                </View>
              ) : null}
              {realisation.priceLabel ? (
                <View style={s.priceChip}>
                  {realisation.priceStrikeLabel ? (
                    <Text style={s.priceStrike}>{realisation.priceStrikeLabel}</Text>
                  ) : null}
                  <Text style={s.priceText}>{realisation.priceLabel}</Text>
                </View>
              ) : null}
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={s.bannerTitle} numberOfLines={2}>
            {businessName}
          </Text>
          {sousTitre ? <Text style={s.bannerMetaText}>{sousTitre}</Text> : null}
        </>
      )}
    </View>
  );

  return (
    <View style={s.canvas}>
      {/* La ou les photos, plein cadre */}
      {avantApres ? (
        <View style={[s.split, empile ? s.splitEmpile : null]}>
          <View style={empile ? s.halfEmpilee : s.half}>
            <PhotoOrPlaceholder
              uri={realisation.beforePhotoUri ?? null}
              hint={addPhoto}
              width={empile ? STORY_W : HALF_W}
              height={empile ? HALF_H : STORY_H}
              cadrage={realisation.beforeCadrage}
            />
          </View>
          {empile && (
            <View pointerEvents="none" style={[s.stackedLabel, { top: 10 }]}>
              <View style={s.splitLabelPill}>
                <Text style={s.splitLabelText}>{i18n.t('storyShare.realisation.before')}</Text>
              </View>
            </View>
          )}
          <View style={empile ? s.splitDividerEmpile : s.splitDivider} />
          {empile && (
            <View pointerEvents="none" style={[s.stackedLabel, { top: HALF_H + DIVIDER_W + 10 }]}>
              <View style={s.splitLabelPill}>
                <Text style={s.splitLabelText}>{i18n.t('storyShare.realisation.after')}</Text>
              </View>
            </View>
          )}
          <View style={empile ? s.halfEmpilee : s.half}>
            <PhotoOrPlaceholder
              uri={realisation.photoUri}
              hint={addPhoto}
              width={empile ? STORY_W : HALF_W}
              height={empile ? HALF_H : STORY_H}
              cadrage={realisation.photoCadrage}
            />
          </View>
        </View>
      ) : (
        <PhotoOrPlaceholder
          uri={realisation.photoUri}
          hint={addPhoto}
          width={STORY_W}
          height={STORY_H}
          cadrage={realisation.photoCadrage}
        />
      )}

      {/* Voiles : lisibilité de l'en-tête et du pied, quelle que soit la photo */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']}
        style={s.scrimTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']}
        style={s.scrimBottom}
        pointerEvents="none"
      />

      <View style={s.content}>
        {/* En-tête de marque — sous la barre de progression Instagram */}
        <View style={s.header}>
          <View style={s.brand}>
            <Image source={LOGO_BLANC} style={s.brandMark} resizeMode="contain" />
            <Text style={s.brandName}>OPATAM</Text>
          </View>
          <Text style={s.eyebrow}>
            {i18n.t(avantApres ? 'storyShare.realisation.badgeAvantApres' : 'storyShare.realisation.badge')}
          </Text>
        </View>

        {avantApres && !empile && (
          <View style={s.splitLabels}>
            <View style={s.splitLabelPill}>
              <Text style={s.splitLabelText}>{i18n.t('storyShare.realisation.before')}</Text>
            </View>
            <View style={s.splitLabelPill}>
              <Text style={s.splitLabelText}>{i18n.t('storyShare.realisation.after')}</Text>
            </View>
          </View>
        )}

        {realisation.bannerPosition === 'top' ? bandeau : null}
        <View style={{ flex: 1 }} />
        {realisation.bannerPosition === 'bottom' ? bandeau : null}

        {/* Pied : le salon et son adresse — en texte, rien n'est cliquable */}
        <View style={s.footer}>
          <View style={s.footerSalon}>
            <View style={s.avatar}>
              <Text style={s.avatarInitial}>{businessName.charAt(0).toUpperCase()}</Text>
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={StyleSheet.absoluteFill} />
              ) : null}
            </View>
            <Text style={s.footerName} numberOfLines={1}>
              {i18n.t('storyShare.review.bookAt', { name: businessName })}
            </Text>
          </View>
          {/* La marque en grand, l'adresse exacte de la page en dessous, discrète */}
          <View style={s.footerBrandRow}>
            <View style={s.footerBrandLine} />
            <Text style={s.footerBrand}>
              opatam<Text style={s.footerBrandTld}>.com</Text>
            </Text>
            <View style={s.footerBrandLine} />
          </View>
          <Text style={s.footerUrl} numberOfLines={1}>
            {adresse}
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: '#101828' },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  placeholderText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },

  split: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  splitEmpile: { flexDirection: 'column' },
  half: { width: HALF_W, height: STORY_H, overflow: 'hidden' },
  halfEmpilee: { width: STORY_W, height: HALF_H, overflow: 'hidden' },
  splitDivider: { width: DIVIDER_W, backgroundColor: 'rgba(255,255,255,0.9)' },
  splitDividerEmpile: { height: DIVIDER_W, backgroundColor: 'rgba(255,255,255,0.9)' },
  splitLabels: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14 },
  stackedLabel: { position: 'absolute', right: 12, zIndex: 2 },
  splitLabelPill: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  splitLabelText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 2 },

  scrimTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 150 },
  scrimBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 300 },

  // Zones sûres Instagram : 64 en haut (barre + nom), 88 en bas (réponse).
  content: {
    ...StyleSheet.absoluteFillObject,
    paddingTop: 64,
    paddingBottom: 88,
    paddingHorizontal: 22,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brandMark: { width: 22, height: 22 },
  brandName: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 2.2 },
  eyebrow: { color: OPATAM_OR, fontSize: 9, fontWeight: '800', letterSpacing: 2 },

  banner: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginVertical: 14,
    gap: 6,
  },
  bannerTitle: { color: OPATAM_BLEU, fontSize: 18, lineHeight: 22, fontWeight: '800' },
  bannerMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  bannerMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bannerMetaText: { color: '#7b8390', fontSize: 12, fontWeight: '600' },
  priceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: OPATAM_OR,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  priceText: { color: OPATAM_BLEU, fontSize: 12.5, fontWeight: '800' },
  priceStrike: {
    color: 'rgba(19,59,143,0.6)',
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },

  footer: { alignItems: 'center', gap: 4 },
  footerSalon: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: OPATAM_BLEU,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarInitial: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  footerName: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  footerBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  footerBrandLine: { width: 28, height: 1, backgroundColor: 'rgba(255,255,255,0.45)' },
  footerBrand: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 1.2 },
  footerBrandTld: { color: OPATAM_OR },
  footerUrl: { color: 'rgba(255,255,255,0.6)', fontSize: 10.5, letterSpacing: 0.3 },
});
