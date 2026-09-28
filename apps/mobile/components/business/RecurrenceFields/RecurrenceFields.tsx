/**
 * RecurrenceFields — « Répéter » une période bloquée ou une activité.
 *
 * Partagé par les écrans block-slot et create-activity : un seul endroit
 * décide de ce qu'est une récurrence à l'écran. La règle (jours, intervalle,
 * horizon) vit dans `@booking-app/shared/utils/recurrence` ; ici on la
 * saisit, on la décrit dans la langue de l'app, et on compte ses
 * occurrences.
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

/** Brouillon par défaut : chaque semaine, le jour de la période, pendant trois mois. */
export function brouillonParDefaut(baseStart: Date): RecurrenceDraft {
  const until = new Date(baseStart.getFullYear(), baseStart.getMonth() + 3, baseStart.getDate());
  return { intervalWeeks: 1, weekdays: [baseStart.getDay()], until };
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
  const until = formatDateLongue(rule.until);
  return rule.intervalWeeks === 1
    ? i18n.t('recurrence.describeWeekly', { days, until })
    : i18n.t('recurrence.describeEveryN', { n: rule.intervalWeeks, days, until });
}

export interface RecurrenceFieldsProps {
  /** `null` = pas de répétition. */
  value: RecurrenceDraft | null;
  onChange: (next: RecurrenceDraft | null) => void;
  /** Période de base : fixe le jour obligatoire et le point de départ. */
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
  const { colors, spacing, radius } = useTheme();
  const [pickerOuvert, setPickerOuvert] = useState(false);

  const jourDeBase = baseStart.getDay();
  const plusieursJours = baseEnd.toDateString() !== baseStart.toDateString();

  const periode = { startDate: baseStart, endDate: baseEnd };
  // Les jours RÉELLEMENT répétés, décidés par le paquet partagé.
  const weekdays = value ? regleAEnregistrer(value, periode, fuseau).weekdays : [];

  const apercu = useMemo(() => {
    if (!value) return null;
    const rule = regleAEnregistrer(value, periode, fuseau);
    const horloge = horlogeDuFuseau(fuseau);
    const code = raisonRegleInvalide(periode, rule, horloge);
    if (code) return { erreur: t(`recurrence.errors.${code}`), texte: null, nombre: 0 };
    const nombre = genererOccurrences(periode, rule, horloge).length;
    return { erreur: null, texte: decrireRecurrence(rule), nombre };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.intervalWeeks, value?.until?.getTime(), value?.weekdays?.join(','), baseStart.getTime(), baseEnd.getTime(), fuseau]);

  const toggleJour = (j: number) => {
    if (!value || j === jourDeBase || plusieursJours) return;
    const next = weekdays.includes(j) ? weekdays.filter((x) => x !== j) : [...weekdays, j];
    onChange({ ...value, weekdays: trierJoursSemaine(next) });
  };

  const choisirUntil = (date: Date | undefined) => {
    if (!value || !date) return;
    onChange({ ...value, until: new Date(date.getFullYear(), date.getMonth(), date.getDate()) });
  };

  return (
    <View style={[s.carte, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
      {/* Interrupteur */}
      <View style={[s.ligne, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}>
        <View style={[s.pastille, { backgroundColor: colors.primaryLight, borderRadius: radius.md }]}>
          <Ionicons name="repeat-outline" size={18} color={colors.primary} />
        </View>
        <Text variant="body" style={{ flex: 1, fontWeight: '500' }}>{t('recurrence.toggle')}</Text>
        <Switch
          value={value !== null}
          disabled={disabled}
          onValueChange={(on) => onChange(on ? brouillonParDefaut(baseStart) : null)}
        />
      </View>

      {value && (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }}>
          {/* Fréquence */}
          <View>
            <Text variant="caption" color="textSecondary" style={{ marginBottom: spacing.xs }}>{t('recurrence.frequency')}</Text>
            <View style={s.chips}>
              {Array.from({ length: INTERVALLE_MAX_SEMAINES }, (_, i) => i + 1).map((n) => {
                const actif = value.intervalWeeks === n;
                return (
                  <Pressable
                    key={n}
                    disabled={disabled}
                    onPress={() => onChange({ ...value, intervalWeeks: n })}
                    style={[
                      s.chip,
                      { borderRadius: radius.full ?? 999, backgroundColor: actif ? colors.primary : colors.surface, borderColor: actif ? colors.primary : colors.border },
                    ]}
                  >
                    <Text variant="bodySmall" style={{ fontWeight: '600', color: actif ? '#fff' : colors.text }}>
                      {n === 1 ? t('recurrence.everyWeek') : t('recurrence.everyNWeeks', { count: n })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Jours */}
          <View>
            <Text variant="caption" color="textSecondary" style={{ marginBottom: spacing.xs }}>
              {plusieursJours ? t('recurrence.dayLabel') : t('recurrence.daysLabel')}
            </Text>
            <View style={s.chips}>
              {[1, 2, 3, 4, 5, 6, 0].map((j) => {
                const actif = weekdays.includes(j);
                const fige = j === jourDeBase || plusieursJours;
                return (
                  <Pressable
                    key={j}
                    disabled={disabled || fige}
                    onPress={() => toggleJour(j)}
                    style={[
                      s.chipJour,
                      {
                        borderRadius: radius.full ?? 999,
                        backgroundColor: actif ? colors.primary : colors.surface,
                        borderColor: actif ? colors.primary : colors.border,
                        opacity: fige && !actif ? 0.4 : 1,
                      },
                    ]}
                  >
                    <Text variant="bodySmall" style={{ fontWeight: '600', color: actif ? '#fff' : colors.text, textTransform: 'capitalize' }}>
                      {nomDuJour(j, 'short').replace('.', '')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {plusieursJours && (
              <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xs }}>{t('recurrence.multiDayNote')}</Text>
            )}
          </View>

          {/* Jusqu'au */}
          <Pressable
            disabled={disabled}
            onPress={() => setPickerOuvert(true)}
            style={({ pressed }) => [
              s.ligne,
              { paddingVertical: spacing.sm, backgroundColor: pressed ? colors.surfaceSecondary : 'transparent', borderRadius: radius.md },
            ]}
          >
            <Text variant="body" style={{ flex: 1, fontWeight: '500' }}>{t('recurrence.until')}</Text>
            <Text variant="body" color="primary" style={{ fontWeight: '500' }}>{formatDateLongue(value.until)}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: spacing.xs }} />
          </Pressable>

          {apercu?.erreur ? (
            <Text variant="bodySmall" color="error">{apercu.erreur}</Text>
          ) : apercu ? (
            <Text variant="caption" color="textSecondary">
              {t('recurrence.summary', { rule: apercu.texte, count: apercu.nombre })}
              {enSerie ? ` ${t('recurrence.seriesNote')}` : ''}
            </Text>
          ) : null}
        </View>
      )}

      {/* Sélecteur « jusqu'au » — natif Android, feuille iOS */}
      {value && pickerOuvert && Platform.OS === 'android' && (
        <DateTimePicker
          value={value.until}
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
                value={value.until}
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
  carte: { borderWidth: 1, overflow: 'hidden' },
  ligne: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  pastille: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  chipJour: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, minWidth: 42, alignItems: 'center' },
  voile: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  feuille: { paddingBottom: 30 },
  feuilleEntete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
});
