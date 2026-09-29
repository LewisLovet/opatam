/**
 * RecurrenceFields — « Répéter » une période bloquée ou une activité.
 *
 * Partagé par les écrans block-slot et create-activity : un seul endroit
 * décide de ce qu'est une récurrence à l'écran. La règle (jours, intervalle,
 * horizon) vit dans `@booking-app/shared/utils/recurrence` ; ici on la
 * saisit, on la décrit dans la langue de l'app, et on montre les dates
 * qu'elle posera réellement.
 *
 * Les jours cochés décident : la date saisie n'est qu'un point de départ,
 * et son jour de semaine se décoche comme les autres.
 *
 * Le composant possède son propre sélecteur de date « jusqu'au » — natif
 * Android, feuille iOS — pour ne rien exiger des écrans qui l'accueillent.
 */
import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Platform, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  genererOccurrences,
  raisonRegleInvalide,
  reglePourPeriode,
  horlogeDuFuseau,
  trierJoursSemaine,
  INTERVALLE_MAX_SEMAINES,
  type RecurrenceRule,
} from '@booking-app/shared';
import i18n from '../../../lib/i18n';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Switch } from '../../Switch';

/** Brouillon de règle : identique à `RecurrenceRule`, nommé pour l'écran. */
export type RecurrenceDraft = RecurrenceRule;

/**
 * La règle à ENREGISTRER pour cette période — ce que l'écran affiche, mot
 * pour mot. Passe par `reglePourPeriode`, comme le schéma et le service :
 * le brouillon pouvait sinon garder un jour de semaine périmé après un
 * changement de date, et la base recevait autre chose que l'aperçu.
 */
export function regleAEnregistrer(
  draft: RecurrenceDraft,
  base: { startDate: Date; endDate: Date },
  fuseau?: string,
): RecurrenceRule {
  return reglePourPeriode(draft, base, horlogeDuFuseau(fuseau));
}

/** Le 4 janvier 2026 est un dimanche : `4 + getDay()` donne le bon nom. */
function nomDuJour(weekday: number, forme: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat(i18n.language, { weekday: forme }).format(new Date(2026, 0, 4 + weekday));
}

function formatDateLongue(d: Date): string {
  return new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

/** « 2026-05-03 » depuis un `Date`, par ses composantes de l'appareil. */
function isoDepuisDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** « 2026-05-03 » → `Date` locale à minuit, pour le sélecteur de date. */
function dateDepuisIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Brouillon par défaut : chaque semaine, le jour de la période, pendant trois mois. */
export function brouillonParDefaut(baseStart: Date): RecurrenceDraft {
  const until = new Date(baseStart.getFullYear(), baseStart.getMonth() + 3, baseStart.getDate());
  return { intervalWeeks: 1, weekdays: [baseStart.getDay()], until: isoDepuisDate(until) };
}

/** « Chaque semaine le samedi, jusqu'au 3 mai 2026 » — dans la langue de l'app. */
export function decrireRecurrence(rule: RecurrenceRule): string {
  const noms = trierJoursSemaine(rule.weekdays).map((j) => nomDuJour(j));
  const days =
    noms.length === 1
      ? i18n.t('recurrence.dayOne', { day: noms[0] })
      : i18n.t('recurrence.dayMany', {
          days: noms.slice(0, -1).join(', ') + i18n.t('recurrence.and') + noms[noms.length - 1],
        });
  const until = formatDateLongue(dateDepuisIso(rule.until));
  return rule.intervalWeeks === 1
    ? i18n.t('recurrence.describeWeekly', { days, until })
    : i18n.t('recurrence.describeEveryN', { n: rule.intervalWeeks, days, until });
}

/** Ordre d'affichage des jours : du lundi au dimanche. */
const JOURS_AFFICHES = [1, 2, 3, 4, 5, 6, 0];
const RACCOURCIS_JOURS = [
  { cle: 'presetWeekdays', jours: [1, 2, 3, 4, 5] },
  { cle: 'presetWeekend', jours: [6, 0] },
  { cle: 'presetAll', jours: [1, 2, 3, 4, 5, 6, 0] },
] as const;
const RACCOURCIS_FIN = [1, 3, 6, 12];
const memesJours = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && trierJoursSemaine([...a]).join(',') === trierJoursSemaine([...b]).join(',');

export interface RecurrenceFieldsProps {
  /** `null` = pas de répétition. */
  value: RecurrenceDraft | null;
  onChange: (next: RecurrenceDraft | null) => void;
  /** Période de base : son début est le point de départ de la série. */
  baseStart: Date;
  baseEnd: Date;
  /** Fuseau du LIEU — l'aperçu compte alors comme le service écrira. */
  fuseau?: string;
  /** Vrai quand la période en édition appartient déjà à une série. */
  enSerie?: boolean;
  disabled?: boolean;
}

export function RecurrenceFields({ value, onChange, baseStart, baseEnd, fuseau, enSerie, disabled }: RecurrenceFieldsProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius, shadows } = useTheme();
  const [pickerOuvert, setPickerOuvert] = useState(false);

  const plusieursJours = baseEnd.toDateString() !== baseStart.toDateString();

  const periode = { startDate: baseStart, endDate: baseEnd };
  // Les jours RÉELLEMENT répétés, décidés par le paquet partagé.
  const regle = value ? regleAEnregistrer(value, periode, fuseau) : null;
  const weekdays = regle?.weekdays ?? [];

  const apercu = useMemo(() => {
    if (!value || !regle) return null;
    const horloge = horlogeDuFuseau(fuseau);
    const code = raisonRegleInvalide(periode, regle, horloge);
    if (code) return { erreur: t(`recurrence.errors.${code}`), occurrences: [] as { startDate: Date }[] };
    return { erreur: null, occurrences: genererOccurrences(periode, regle, horloge) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.intervalWeeks, value?.until, value?.weekdays?.join(','), baseStart.getTime(), baseEnd.getTime(), fuseau, i18n.language]);

  /** Une date d'occurrence, lue dans le fuseau du lieu : « sam. 3 oct. ». */
  const dateCourte = (d: Date) =>
    new Intl.DateTimeFormat(i18n.language, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...(fuseau ? { timeZone: fuseau } : {}),
    }).format(d);

  const changerJours = (jours: readonly number[]) => value && onChange({ ...value, weekdays: trierJoursSemaine([...jours]) });
  const basculerJour = (j: number) => {
    if (!value) return;
    // Plusieurs jours : un seul départ possible — toucher un jour le choisit.
    if (plusieursJours) return changerJours([j]);
    changerJours(weekdays.includes(j) ? weekdays.filter((x) => x !== j) : [...weekdays, j]);
  };
  const finDans = (mois: number) => {
    const d = new Date(baseStart.getFullYear(), baseStart.getMonth() + mois, baseStart.getDate());
    // « 1 an » ne doit pas dépasser l'horizon (366 jours) : on recule d'un jour.
    if (mois === 12) d.setDate(d.getDate() - 1);
    return isoDepuisDate(d);
  };

  const choisirUntil = (date: Date | undefined) => {
    if (!value || !date) return;
    // Une DATE calendaire, pas un instant : « jusqu'au 3 mai » veut dire la
    // même chose partout, et rouvrir la série ailleurs ne la déplace plus.
    onChange({ ...value, until: isoDepuisDate(date) });
  };

  const frequence = (n: number) => (n === 1 ? t('recurrence.everyWeek') : t('recurrence.everyNWeeks', { count: n }));
  const resume = regle
    ? `${frequence(regle.intervalWeeks)} · ${
        weekdays.length === 7
          ? t('recurrence.everyDay')
          : weekdays.map((j) => nomDuJour(j, 'short').replace('.', '')).join(' ') || t('recurrence.noDay')
      }`
    : t('recurrence.once');

  const etiquette = [s.etiquette, { color: colors.textSecondary }];
  const occurrences = apercu?.occurrences ?? [];

  return (
    <View style={[s.carte, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }, shadows.sm]}>
      {/* En-tête : ce que fait la répétition, en une ligne, et l'interrupteur. */}
      <View style={[s.ligne, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}>
        <View style={[s.pastille, { backgroundColor: value ? colors.primary : colors.primaryLight, borderRadius: radius.md }]}>
          <Ionicons name="repeat" size={18} color={value ? '#fff' : colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="body" style={{ fontWeight: '600' }}>{t('recurrence.toggle')}</Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>{resume}</Text>
        </View>
        <Switch
          value={value !== null}
          disabled={disabled}
          onValueChange={(on) => onChange(on ? brouillonParDefaut(baseStart) : null)}
        />
      </View>

      {value && (
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, padding: spacing.lg, gap: spacing.lg }}>
          {/* Fréquence — un sélecteur segmenté. */}
          <View>
            <Text variant="caption" style={etiquette}>{t('recurrence.frequency')}</Text>
            <View style={[s.segments, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderRadius: radius.md }]}>
              {Array.from({ length: INTERVALLE_MAX_SEMAINES }, (_, i) => i + 1).map((n) => {
                const actif = value.intervalWeeks === n;
                return (
                  <Pressable
                    key={n}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected: actif }}
                    accessibilityLabel={frequence(n)}
                    onPress={() => onChange({ ...value, intervalWeeks: n })}
                    style={[s.segment, { borderRadius: radius.sm }, actif && [{ backgroundColor: colors.surface }, shadows.sm]]}
                  >
                    <Text
                      variant="caption"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={{ fontWeight: actif ? '700' : '500', color: actif ? colors.text : colors.textSecondary }}
                    >
                      {n === 1 ? t('recurrence.everyWeekShort') : t('recurrence.everyNWeeksShort', { n })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Jours — des pastilles rondes, et les raccourcis usuels. */}
          <View>
            <View style={[s.ligneEtiquette, { marginBottom: spacing.sm }]}>
              <Text variant="caption" style={[etiquette, { marginBottom: 0 }]}>
                {plusieursJours ? t('recurrence.dayLabel') : t('recurrence.daysLabel')}
              </Text>
              {!plusieursJours && (
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  {RACCOURCIS_JOURS.map((r) => {
                    const actif = memesJours(weekdays, r.jours);
                    return (
                      <Pressable key={r.cle} disabled={disabled} hitSlop={8} onPress={() => changerJours(r.jours)}>
                        <Text variant="caption" style={{ fontWeight: '600', color: actif ? colors.primary : colors.textSecondary }}>
                          {t(`recurrence.${r.cle}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
            <View style={s.jours}>
              {JOURS_AFFICHES.map((j) => {
                const actif = weekdays.includes(j);
                return (
                  <Pressable
                    key={j}
                    disabled={disabled}
                    onPress={() => basculerJour(j)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: actif }}
                    accessibilityLabel={nomDuJour(j)}
                    style={({ pressed }) => [
                      s.jour,
                      actif
                        ? [{ backgroundColor: colors.primary, borderColor: colors.primary }, shadows.sm]
                        : { backgroundColor: colors.surface, borderColor: colors.border },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text variant="bodySmall" style={{ fontWeight: '700', color: actif ? '#fff' : colors.textSecondary }}>
                      {nomDuJour(j, 'short').charAt(0).toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {plusieursJours && (
              <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.sm }}>{t('recurrence.multiDayNote')}</Text>
            )}
          </View>

          {/* Jusqu'au — une date, ou une durée d'un geste. */}
          <View>
            <Text variant="caption" style={etiquette}>{t('recurrence.until')}</Text>
            <Pressable
              disabled={disabled}
              onPress={() => setPickerOuvert(true)}
              style={({ pressed }) => [
                s.champDate,
                {
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
                },
              ]}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.primary} style={{ marginRight: spacing.sm }} />
              <Text variant="body" style={{ flex: 1, fontWeight: '500' }}>{formatDateLongue(dateDepuisIso(value.until))}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
            <View style={[s.raccourcisFin, { marginTop: spacing.sm }]}>
              {RACCOURCIS_FIN.map((mois) => {
                const cible = finDans(mois);
                const actif = value.until === cible;
                return (
                  <Pressable
                    key={mois}
                    disabled={disabled}
                    onPress={() => onChange({ ...value, until: cible })}
                    style={[
                      s.raccourciFin,
                      {
                        borderRadius: radius.md,
                        backgroundColor: actif ? colors.primaryLight : colors.surfaceSecondary,
                        borderColor: actif ? colors.primary : 'transparent',
                      },
                    ]}
                  >
                    <Text variant="caption" numberOfLines={1} style={{ fontWeight: '600', color: actif ? colors.primary : colors.textSecondary }}>
                      {mois === 12 ? t('recurrence.untilYear') : t('recurrence.untilMonths', { count: mois })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Ce que la série va réellement poser — les vraies dates. */}
          {apercu?.erreur ? (
            <View style={[s.encart, { backgroundColor: colors.errorLight, borderRadius: radius.md }]}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} style={{ marginRight: spacing.sm }} />
              <Text variant="bodySmall" style={{ flex: 1, color: colors.errorDark }}>{apercu.erreur}</Text>
            </View>
          ) : occurrences.length > 0 ? (
            <View style={[s.encart, { backgroundColor: colors.primaryLight, borderRadius: radius.md }]}>
              <Ionicons name="calendar" size={18} color={colors.primary} style={{ marginRight: spacing.sm, marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text variant="bodySmall">
                  <Text variant="bodySmall" style={{ fontWeight: '700' }}>
                    {t('recurrence.dates', { count: occurrences.length })}
                  </Text>
                  {' · '}
                  {t('recurrence.range', {
                    from: dateCourte(occurrences[0].startDate),
                    to: dateCourte(occurrences[occurrences.length - 1].startDate),
                  })}
                </Text>
                <View style={[s.dates, { marginTop: spacing.sm }]}>
                  {occurrences.slice(0, 4).map((o) => (
                    <View key={o.startDate.getTime()} style={[s.date, { backgroundColor: colors.surface, borderRadius: radius.sm }]}>
                      <Text variant="caption" style={{ fontWeight: '600' }}>{dateCourte(o.startDate)}</Text>
                    </View>
                  ))}
                  {occurrences.length > 4 && (
                    <Text variant="caption" color="textSecondary" style={{ alignSelf: 'center', marginLeft: 2 }}>
                      +{occurrences.length - 4}
                    </Text>
                  )}
                </View>
                {enSerie ? (
                  <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.sm }}>{t('recurrence.seriesNote')}</Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      )}

      {/* Sélecteur « jusqu'au » — natif Android, feuille iOS */}
      {value && pickerOuvert && Platform.OS === 'android' && (
        <DateTimePicker
          value={dateDepuisIso(value.until)}
          mode="date"
          minimumDate={baseStart}
          onChange={(_: unknown, date?: Date) => {
            setPickerOuvert(false);
            choisirUntil(date);
          }}
        />
      )}
      {value && pickerOuvert && Platform.OS === 'ios' && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setPickerOuvert(false)}>
          <View style={s.voile}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerOuvert(false)} />
            <View style={[s.feuille, { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}>
              <View style={[s.feuilleEntete, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomColor: colors.border }]}>
                <Pressable onPress={() => setPickerOuvert(false)} hitSlop={8}>
                  <Text variant="body" color="textSecondary">{t('common.cancel')}</Text>
                </Pressable>
                <Text variant="body" style={{ fontWeight: '600' }}>{t('recurrence.untilTitle')}</Text>
                <Pressable onPress={() => setPickerOuvert(false)} hitSlop={8}>
                  <Text variant="body" color="primary" style={{ fontWeight: '600' }}>OK</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={dateDepuisIso(value.until)}
                mode="date"
                display="inline"
                minimumDate={baseStart}
                onChange={(_: unknown, date?: Date) => choisirUntil(date)}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  carte: { borderWidth: 1 },
  ligne: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  pastille: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  etiquette: { textTransform: 'uppercase', fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
  ligneEtiquette: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segments: { flexDirection: 'row', padding: 3, borderWidth: StyleSheet.hairlineWidth, gap: 3 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, paddingHorizontal: 2 },
  jours: { flexDirection: 'row', justifyContent: 'space-between' },
  jour: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  champDate: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, height: 46 },
  raccourcisFin: { flexDirection: 'row', gap: 6 },
  raccourciFin: { flex: 1, alignItems: 'center', paddingVertical: 7, borderWidth: 1 },
  encart: { flexDirection: 'row', alignItems: 'flex-start', padding: 12 },
  dates: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  date: { paddingHorizontal: 6, paddingVertical: 2 },
  voile: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  feuille: { paddingBottom: 30 },
  feuilleEntete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
});
