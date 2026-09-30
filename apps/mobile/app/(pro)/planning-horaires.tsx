/**
 * Planning — les horaires d'un membre JOUR PAR JOUR.
 *
 * La semaine type (écran « Disponibilités ») reste la base ; ici on la
 * retouche date par date : fermer un jour, ouvrir un samedi, poser des
 * horaires sur une période, copier une semaine sur les suivantes. Et
 * l'option « horaires variables » pour ceux dont l'agenda change chaque
 * semaine : la semaine type ne s'applique plus, seuls les jours ouverts ici
 * sont réservables.
 *
 * Ce qui est affiché est ce que le moteur de créneaux applique : les deux
 * passent par la même règle (`horairesDuJour`).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import i18n from '../../lib/i18n';
import { useTheme } from '../../theme';
import { Text, Button, Card, useToast } from '../../components';
import { useProvider, useEspaceMembre } from '../../contexts';
import {
  schedulingService,
  memberService,
  type WithId,
  type PlanningHoraires,
  type JourDuPlanning,
  type HorairesDatesInput,
} from '@booking-app/firebase';
import {
  ajouterJours,
  jourLocalDe,
  lundiDe,
  raisonHorairesDatesInvalides,
  DUREE_MAX_HORAIRES_DATES_JOURS,
} from '@booking-app/shared';
import type { AvailabilityConflict, DatedAvailability, DatedAvailabilityMode, Member, TimeSlot } from '@booking-app/shared/types';
import { MEMBER_COLORS } from '@booking-app/shared/constants';

// ---------------------------------------------------------------------------
// Dates « YYYY-MM-DD » (calendrier du lieu) ↔ affichage
// ---------------------------------------------------------------------------

const dateDe = (jour: string) => {
  const [a, m, j] = jour.split('-').map(Number);
  return new Date(a, m - 1, j);
};
const format = (jour: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(i18n.language, o).format(dateDe(jour));
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// 2023-01-01 (UTC) est un dimanche → getDay 0.
const nomJour = (dow: number, f: 'short' | 'narrow' | 'long') =>
  majuscule(new Intl.DateTimeFormat(i18n.language, { weekday: f, timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + dow))));
const LUNDI_A_DIMANCHE = [1, 2, 3, 4, 5, 6, 0];

/** « 09:00 » → « 9 », « 09:30 » → « 9:30 », « 24:00 » → « 24 » — pour une case de 7 colonnes. */
const heureCourte = (hhmm: string) => {
  const [h, m] = hhmm.split(':');
  return m === '00' ? String(Number(h)) : `${Number(h)}:${m}`;
};
const plageLisible = (p: TimeSlot) => `${p.start}–${p.end === '24:00' ? '00:00' : p.end}`;

/** Une fin choisie à « 00:00 » = minuit, fin de journée. */
const heureDe = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const dateDeHeure = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(2000, 0, 1, h === 24 ? 0 : h, m);
  return d;
};

const moisSuivant = (mois: string, n: number) => {
  const [a, m] = mois.split('-').map(Number);
  return jourLocalDe(new Date(a, m - 1 + n, 1)).slice(0, 7);
};

const MAX_PLAGES = 4;

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function PlanningHorairesScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { providerId } = useProvider();
  const { monMemberId } = useEspaceMembre();
  const params = useLocalSearchParams<{ memberId?: string }>();

  const aujourdhui = jourLocalDe(new Date());
  const [membres, setMembres] = useState<WithId<Member>[]>([]);
  const [membresCharges, setMembresCharges] = useState(false);
  const [membreId, setMembreId] = useState<string | null>(monMemberId ?? params.memberId ?? null);
  const [mois, setMois] = useState(aujourdhui.slice(0, 7));
  const [planning, setPlanning] = useState<PlanningHoraires | null>(null);
  const [chargement, setChargement] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [jourEdite, setJourEdite] = useState<JourDuPlanning | null>(null);
  const [lundiCopie, setLundiCopie] = useState<string | null>(null);
  const [basculeVariables, setBasculeVariables] = useState(false);

  const membre = membres.find((m) => m.id === membreId) ?? null;

  // La grille : du lundi de la semaine du 1er au dimanche de la semaine du dernier jour.
  const { debut, fin } = useMemo(() => {
    const premier = `${mois}-01`;
    const dernier = ajouterJours(`${moisSuivant(mois, 1)}-01`, -1);
    return { debut: lundiDe(premier, ajouterJours), fin: ajouterJours(lundiDe(dernier, ajouterJours), 6) };
  }, [mois]);

  useEffect(() => {
    if (!providerId) return;
    memberService
      .getActiveByProvider(providerId)
      .then((liste) => {
        // Espace membre : SES horaires seulement.
        const visibles = monMemberId ? liste.filter((m) => m.id === monMemberId) : liste;
        setMembres(visibles);
        setMembreId((actuel) => (actuel && visibles.some((m) => m.id === actuel) ? actuel : visibles[0]?.id ?? null));
      })
      .catch(() => setMembres([]))
      .finally(() => setMembresCharges(true));
  }, [providerId, monMemberId]);

  const charger = useCallback(async () => {
    if (!providerId || !membreId) return;
    try {
      setPlanning(await schedulingService.getPlanningHoraires(providerId, membreId, debut, fin));
    } catch (err) {
      console.error('[planning] lecture', err);
      showToast({ variant: 'error', message: t('planningHoraires.erreurChargement') });
    }
  }, [providerId, membreId, debut, fin, showToast, t]);

  useEffect(() => {
    setChargement(true);
    charger().finally(() => setChargement(false));
  }, [charger]);

  const rafraichir = async () => {
    setRafraichit(true);
    await charger();
    setRafraichit(false);
  };

  /** Prévient des rendez-vous qui sortiraient des horaires ; `true` = on continue. */
  const confirmerConflits = (conflits: AvailabilityConflict[]) =>
    new Promise<boolean>((ok) => {
      if (conflits.length === 0) return ok(true);
      const lignes = conflits.slice(0, 5).map((c) => {
        const d = c.bookingDate instanceof Date ? c.bookingDate : new Date(c.bookingDate);
        const quand = new Intl.DateTimeFormat(i18n.language, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
        return `• ${c.clientName || '—'}, ${quand}`;
      });
      if (conflits.length > 5) lignes.push(t('planningHoraires.conflits.etAutres', { count: conflits.length - 5 }));
      Alert.alert(
        t('planningHoraires.conflits.titre', { count: conflits.length }),
        `${t('planningHoraires.conflits.message')}\n\n${lignes.join('\n')}`,
        [
          { text: t('common.cancel'), style: 'cancel', onPress: () => ok(false) },
          { text: t('planningHoraires.conflits.continuer'), style: 'destructive', onPress: () => ok(true) },
        ],
        { cancelable: true, onDismiss: () => ok(false) },
      );
    });

  const basculerHorairesVariables = async (actif: boolean) => {
    if (!providerId || !membreId) return;
    setBasculeVariables(true);
    try {
      const { conflicts } = await schedulingService.setHorairesVariables(providerId, membreId, actif, { ecrire: false });
      const suite = await new Promise<boolean>((ok) =>
        Alert.alert(
          t(actif ? 'planningHoraires.variables.activerTitre' : 'planningHoraires.variables.desactiverTitre'),
          t(actif ? 'planningHoraires.variables.activerMessage' : 'planningHoraires.variables.desactiverMessage'),
          [
            { text: t('common.cancel'), style: 'cancel', onPress: () => ok(false) },
            { text: t('common.confirm'), onPress: () => ok(true) },
          ],
          { cancelable: true, onDismiss: () => ok(false) },
        ),
      );
      if (!suite || !(await confirmerConflits(conflicts))) return;
      await schedulingService.setHorairesVariables(providerId, membreId, actif);
      await charger();
      showToast({ variant: 'success', message: t(actif ? 'planningHoraires.variables.active' : 'planningHoraires.variables.desactive') });
    } catch (err) {
      console.error('[planning] horaires variables', err);
      showToast({ variant: 'error', message: t('planningHoraires.erreurEnregistrement') });
    } finally {
      setBasculeVariables(false);
    }
  };

  const supprimerReglage = async (reglage: WithId<DatedAvailability>) => {
    if (!providerId) return;
    try {
      const conflits = await schedulingService.conflitsSuppressionHorairesDates(providerId, reglage);
      const suite = await new Promise<boolean>((ok) =>
        Alert.alert(t('planningHoraires.reglages.supprimerTitre'), t('planningHoraires.reglages.supprimerMessage'), [
          { text: t('common.cancel'), style: 'cancel', onPress: () => ok(false) },
          { text: t('planningHoraires.reglages.supprimer'), style: 'destructive', onPress: () => ok(true) },
        ], { cancelable: true, onDismiss: () => ok(false) }),
      );
      if (!suite || !(await confirmerConflits(conflits))) return;
      await schedulingService.supprimerHorairesDates(providerId, reglage.id);
      await charger();
      showToast({ variant: 'success', message: t('planningHoraires.reglages.supprime') });
    } catch (err) {
      console.error('[planning] suppression', err);
      showToast({ variant: 'error', message: t('planningHoraires.erreurEnregistrement') });
    }
  };

  const semaines = useMemo(() => {
    const jours = planning?.jours ?? [];
    const lignes: JourDuPlanning[][] = [];
    for (let i = 0; i < jours.length; i += 7) lignes.push(jours.slice(i, i + 7));
    return lignes;
  }, [planning]);

  const lundiCourant = lundiDe(aujourdhui, ajouterJours);
  const horairesVariables = planning?.horairesVariables === true;
  const couleurMembre = membre?.color || MEMBER_COLORS[0];

  const resumeReglage = (r: WithId<DatedAvailability>) => {
    const periode =
      r.from === r.to
        ? format(r.from, { weekday: 'short', day: 'numeric', month: 'short' })
        : t('planningHoraires.reglages.periode', {
            du: format(r.from, { day: 'numeric', month: 'short' }),
            au: format(r.to, { day: 'numeric', month: 'short' }),
          });
    const jours = r.weekdays.length > 0 && r.from !== r.to ? LUNDI_A_DIMANCHE.filter((j) => r.weekdays.includes(j)).map((j) => nomJour(j, 'short')).join(', ') : '';
    const quoi =
      r.mode === 'slots'
        ? r.slots.map(plageLisible).join(', ')
        : r.mode === 'closed'
          ? t('planningHoraires.ferme')
          : t('planningHoraires.habituels');
    return { periode, jours, quoi };
  };

  return (
    <View style={[s.conteneur, { backgroundColor: colors.background }]}>
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top }}>
        <View style={s.entete}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text variant="h3" style={{ color: '#FFFFFF' }}>{t('planningHoraires.titre')}</Text>
            {membre && membres.length === 1 && (
              <Text variant="caption" style={{ color: 'rgba(255,255,255,0.85)' }}>{membre.name}</Text>
            )}
          </View>
        </View>
      </View>

      {membres.length > 1 && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              {membres.map((m) => {
                const choisi = m.id === membreId;
                const couleur = m.color || MEMBER_COLORS[0];
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => setMembreId(m.id)}
                    style={[s.pastille, { backgroundColor: choisi ? couleur : colors.surfaceSecondary, borderRadius: radius.full }]}
                  >
                    <View style={[s.point, { backgroundColor: choisi ? '#FFFFFF' : couleur }]} />
                    <Text variant="caption" style={{ color: choisi ? '#FFFFFF' : colors.text, fontWeight: choisi ? '600' : '400' }}>
                      {m.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}

      {!membresCharges || (chargement && !planning && membre) ? (
        <View style={s.centre}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !membre ? (
        <View style={s.centre}>
          <Ionicons name="people-outline" size={48} color={colors.textMuted} />
          <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.md }}>
            {t('proAvailability.emptyMembers')}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'], gap: spacing.lg }}
          refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={rafraichir} tintColor={colors.primary} />}
        >
          {/* Horaires variables */}
          <Card padding="md" shadow="sm">
            <View style={s.ligne}>
              <Ionicons name="shuffle-outline" size={20} color={colors.primary} />
              <Text variant="body" style={{ flex: 1, fontWeight: '600' }}>{t('planningHoraires.variables.titre')}</Text>
              {basculeVariables ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Switch
                  value={horairesVariables}
                  onValueChange={basculerHorairesVariables}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              )}
            </View>
            <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xs }}>
              {t(horairesVariables ? 'planningHoraires.variables.descriptionActive' : 'planningHoraires.variables.description')}
            </Text>
          </Card>

          {/* Mois */}
          <Card padding="md" shadow="sm">
            <View style={[s.ligne, { marginBottom: spacing.md }]}>
              <Pressable
                hitSlop={10}
                disabled={mois <= aujourdhui.slice(0, 7)}
                onPress={() => setMois((m) => moisSuivant(m, -1))}
                style={{ opacity: mois <= aujourdhui.slice(0, 7) ? 0.3 : 1 }}
              >
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </Pressable>
              <Text variant="h3" align="center" style={{ flex: 1 }}>
                {majuscule(format(`${mois}-01`, { month: 'long', year: 'numeric' }))}
              </Text>
              <Pressable hitSlop={10} onPress={() => setMois((m) => moisSuivant(m, 1))}>
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </Pressable>
            </View>

            <View style={s.rangee}>
              {LUNDI_A_DIMANCHE.map((j) => (
                <Text key={j} variant="caption" color="textMuted" align="center" style={s.colonne}>
                  {nomJour(j, 'narrow')}
                </Text>
              ))}
              <View style={s.colonneCopie} />
            </View>

            {semaines.map((semaine) => {
              const lundi = semaine[0].jour;
              const copiable = lundi >= ajouterJours(lundiCourant, -7);
              return (
                <View key={lundi} style={[s.rangee, { marginTop: 4 }]}>
                  {semaine.map((j) => {
                    const horsMois = j.jour.slice(0, 7) !== mois;
                    const passe = j.jour < aujourdhui;
                    const estAujourdhui = j.jour === aujourdhui;
                    const regle = j.source === 'date';
                    return (
                      <Pressable
                        key={j.jour}
                        disabled={passe}
                        onPress={() => setJourEdite(j)}
                        style={({ pressed }) => [
                          s.colonne,
                          s.case,
                          {
                            borderRadius: radius.md,
                            backgroundColor: j.ouvert ? colors.primaryLight : colors.surfaceSecondary,
                            borderColor: regle ? colors.primary : estAujourdhui ? colors.text : 'transparent',
                            borderWidth: regle || estAujourdhui ? 1.5 : 0,
                            opacity: pressed ? 0.7 : horsMois ? 0.35 : passe ? 0.5 : 1,
                          },
                        ]}
                      >
                        <Text variant="caption" style={{ fontWeight: estAujourdhui ? '800' : '600', color: j.ouvert ? colors.primary : colors.textMuted }}>
                          {Number(j.jour.slice(8))}
                        </Text>
                        <Text numberOfLines={1} style={{ fontSize: 9, lineHeight: 12, color: j.ouvert ? colors.primary : colors.textMuted }}>
                          {j.ouvert ? `${heureCourte(j.plages[0].start)}–${heureCourte(j.plages[j.plages.length - 1].end)}` : '—'}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    disabled={!copiable}
                    hitSlop={6}
                    onPress={() => setLundiCopie(lundi)}
                    style={[s.colonneCopie, { opacity: copiable ? 1 : 0 }]}
                    accessibilityLabel={t('planningHoraires.copier.bouton')}
                  >
                    <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
                  </Pressable>
                </View>
              );
            })}

            <View style={[s.ligne, { marginTop: spacing.md, flexWrap: 'wrap', rowGap: 4 }]}>
              <View style={[s.legende, { backgroundColor: colors.primaryLight, borderColor: colors.primary, borderWidth: 1.5 }]} />
              <Text variant="caption" color="textSecondary">{t('planningHoraires.legende.regle')}</Text>
              <View style={[s.legende, { backgroundColor: colors.primaryLight, marginLeft: spacing.sm }]} />
              <Text variant="caption" color="textSecondary">
                {t(horairesVariables ? 'planningHoraires.legende.ouvert' : 'planningHoraires.legende.semaine')}
              </Text>
            </View>
            <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
              {t('planningHoraires.aide')}
            </Text>
          </Card>

          {/* Réglages en cours */}
          {planning && planning.reglages.length > 0 && (
            <Card padding="md" shadow="sm">
              <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t('planningHoraires.reglages.titre')}
              </Text>
              {planning.reglages.map((r, i) => {
                const { periode, jours, quoi } = resumeReglage(r);
                return (
                  <View key={r.id} style={[s.ligne, { paddingVertical: spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.divider }]}>
                    <Ionicons
                      name={r.mode === 'closed' ? 'close-circle-outline' : r.mode === 'usual' ? 'refresh-outline' : 'time-outline'}
                      size={18}
                      color={r.mode === 'closed' ? colors.textMuted : colors.primary}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="bodySmall" style={{ fontWeight: '600' }}>{majuscule(periode)}</Text>
                      <Text variant="caption" color="textSecondary">{jours ? `${jours} · ${quoi}` : quoi}</Text>
                    </View>
                    <Pressable hitSlop={10} onPress={() => supprimerReglage(r)} accessibilityLabel={t('planningHoraires.reglages.supprimer')}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          )}

          {!monMemberId && (
            <Button
              variant="outline"
              title={t('planningHoraires.semaineType')}
              onPress={() => router.push('/(pro)/availability' as never)}
            />
          )}
        </ScrollView>
      )}

      {jourEdite && membre && providerId && (
        <EditeurJour
          jour={jourEdite}
          membre={membre}
          providerId={providerId}
          horairesVariables={horairesVariables}
          couleur={couleurMembre}
          confirmerConflits={confirmerConflits}
          onFermer={() => setJourEdite(null)}
          onEnregistre={async () => {
            setJourEdite(null);
            await charger();
            showToast({ variant: 'success', message: t('planningHoraires.enregistre') });
          }}
        />
      )}

      {lundiCopie && membre && providerId && (
        <CopieSemaine
          lundi={lundiCopie}
          membre={membre}
          providerId={providerId}
          confirmerConflits={confirmerConflits}
          onFermer={() => setLundiCopie(null)}
          onCopie={async (n) => {
            setLundiCopie(null);
            await charger();
            showToast({ variant: 'success', message: t('planningHoraires.copier.fait', { count: n }) });
          }}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Éditeur d'un jour (et d'une période qui part de ce jour)
// ---------------------------------------------------------------------------

function EditeurJour({
  jour,
  membre,
  providerId,
  horairesVariables,
  couleur,
  confirmerConflits,
  onFermer,
  onEnregistre,
}: {
  jour: JourDuPlanning;
  membre: WithId<Member>;
  providerId: string;
  horairesVariables: boolean;
  couleur: string;
  confirmerConflits: (c: AvailabilityConflict[]) => Promise<boolean>;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [mode, setMode] = useState<DatedAvailabilityMode>(jour.ouvert ? 'slots' : 'closed');
  const [plages, setPlages] = useState<TimeSlot[]>(jour.ouvert ? jour.plages.map((p) => ({ ...p })) : [{ start: '09:00', end: '18:00' }]);
  const [repeter, setRepeter] = useState(false);
  const [finPeriode, setFinPeriode] = useState(ajouterJours(jour.jour, 27));
  const [joursChoisis, setJoursChoisis] = useState<number[]>([jour.jourSemaine]);
  const [heureOuverte, setHeureOuverte] = useState<{ i: number; champ: 'start' | 'end' } | null>(null);
  const [dateOuverte, setDateOuverte] = useState(false);
  const [enregistre, setEnregistre] = useState(false);

  const modes: Array<{ id: DatedAvailabilityMode; libelle: string }> = [
    { id: 'slots', libelle: t('planningHoraires.editeur.ouvert') },
    { id: 'closed', libelle: t('planningHoraires.ferme') },
    // Pour un membre en horaires variables, « habituel » = fermé : inutile.
    ...(horairesVariables ? [] : [{ id: 'usual' as const, libelle: t('planningHoraires.habituels') }]),
  ];

  const changerHeure = (i: number, champ: 'start' | 'end', valeur: string) =>
    setPlages((ps) => ps.map((p, k) => (k === i ? { ...p, [champ]: champ === 'end' && valeur === '00:00' ? '24:00' : valeur } : p)));

  const enregistrer = async () => {
    if (!membre.locationId) {
      showToast({ variant: 'error', message: t('proAvailability.validation.noLocation') });
      return;
    }
    const input: HorairesDatesInput = {
      memberId: membre.id,
      locationId: membre.locationId,
      from: jour.jour,
      to: repeter ? finPeriode : jour.jour,
      weekdays: repeter ? joursChoisis : [],
      mode,
      slots: mode === 'slots' ? plages : [],
    };
    const raison = raisonHorairesDatesInvalides(input);
    if (raison) {
      showToast({ variant: 'error', message: t(`planningHoraires.erreurs.${raison}`) });
      return;
    }
    if (repeter && joursChoisis.length === 0) {
      showToast({ variant: 'error', message: t('planningHoraires.erreurs.jours') });
      return;
    }
    setEnregistre(true);
    try {
      const conflits = await schedulingService.conflitsHorairesDates(providerId, input);
      if (!(await confirmerConflits(conflits))) return;
      await schedulingService.setHorairesDates(providerId, input);
      onEnregistre();
    } catch (err) {
      console.error('[planning] enregistrement', err);
      showToast({ variant: 'error', message: t('planningHoraires.erreurEnregistrement') });
    } finally {
      setEnregistre(false);
    }
  };

  const titre = majuscule(format(jour.jour, { weekday: 'long', day: 'numeric', month: 'long' }));
  const actuel = jour.ouvert ? jour.plages.map(plageLisible).join(', ') : t('planningHoraires.ferme');
  const origine = t(`planningHoraires.source.${jour.source}`);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onFermer}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[s.enteteFeuille, { borderBottomColor: colors.divider, paddingHorizontal: spacing.lg }]}>
          <Pressable onPress={onFermer} hitSlop={10}>
            <Text variant="body" color="textSecondary">{t('common.cancel')}</Text>
          </Pressable>
          <Text variant="body" style={{ fontWeight: '700' }}>{titre}</Text>
          <Pressable onPress={enregistrer} hitSlop={10} disabled={enregistre}>
            {enregistre ? <ActivityIndicator size="small" color={colors.primary} /> : <Text variant="body" color="primary" style={{ fontWeight: '700' }}>{t('common.save')}</Text>}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing['3xl'] }}>
          <View style={[s.ligne, { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary }]}>
            <View style={[s.point, { backgroundColor: couleur }]} />
            <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>
              {t('planningHoraires.editeur.actuellement', { horaires: actuel, origine })}
            </Text>
          </View>

          {/* Mode */}
          <View style={[s.segments, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}>
            {modes.map((m) => {
              const choisi = mode === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setMode(m.id)}
                  style={[s.segment, { borderRadius: radius.sm, backgroundColor: choisi ? colors.surface : 'transparent' }]}
                >
                  <Text variant="bodySmall" style={{ fontWeight: choisi ? '700' : '500', color: choisi ? colors.text : colors.textSecondary }}>
                    {m.libelle}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {mode === 'slots' && (
            <Card padding="md" shadow="sm">
              {plages.map((p, i) => (
                <View key={i} style={{ marginBottom: i < plages.length - 1 ? spacing.sm : 0 }}>
                  <View style={s.ligne}>
                    {(['start', 'end'] as const).map((champ, k) => {
                      const actif = heureOuverte?.i === i && heureOuverte.champ === champ;
                      const valeur = p[champ] === '24:00' ? '00:00' : p[champ];
                      return (
                        <React.Fragment key={champ}>
                          {k === 1 && <Text variant="body" color="textMuted">–</Text>}
                          <Pressable
                            onPress={() => setHeureOuverte(actif ? null : { i, champ })}
                            style={[s.heure, { backgroundColor: actif ? colors.primaryLight : colors.surfaceSecondary, borderRadius: radius.sm }]}
                          >
                            <Text variant="body" style={{ fontWeight: '600', color: actif ? colors.primary : colors.text }}>{valeur}</Text>
                          </Pressable>
                        </React.Fragment>
                      );
                    })}
                    <View style={{ flex: 1 }} />
                    {plages.length > 1 && (
                      <Pressable hitSlop={8} onPress={() => { setHeureOuverte(null); setPlages((ps) => ps.filter((_, k) => k !== i)); }}>
                        <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                      </Pressable>
                    )}
                  </View>
                  {heureOuverte?.i === i && (
                    <DateTimePicker
                      value={dateDeHeure(p[heureOuverte.champ])}
                      mode="time"
                      is24Hour
                      minuteInterval={5}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      themeVariant="light"
                      onChange={(e, d) => {
                        if (Platform.OS === 'android') setHeureOuverte(null);
                        if (d && e.type !== 'dismissed') changerHeure(i, heureOuverte.champ, heureDe(d));
                      }}
                    />
                  )}
                </View>
              ))}
              {plages.length < MAX_PLAGES && (
                <Pressable
                  onPress={() => {
                    const derniere = plages[plages.length - 1]?.end ?? '18:00';
                    setPlages((ps) => [...ps, { start: derniere === '24:00' ? '20:00' : derniere, end: derniere >= '22:00' ? '24:00' : '22:00' }]);
                  }}
                  style={[s.ligne, { marginTop: spacing.md }]}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  <Text variant="bodySmall" color="primary" style={{ fontWeight: '600' }}>{t('planningHoraires.editeur.ajouterPlage')}</Text>
                </Pressable>
              )}
            </Card>
          )}

          {mode === 'usual' && (
            <Text variant="caption" color="textSecondary">{t('planningHoraires.editeur.habituelsAide')}</Text>
          )}

          {/* Répéter sur une période */}
          <Card padding="md" shadow="sm">
            <View style={s.ligne}>
              <Ionicons name="repeat-outline" size={20} color={colors.primary} />
              <Text variant="body" style={{ flex: 1, fontWeight: '600' }}>{t('planningHoraires.editeur.repeter')}</Text>
              <Switch
                value={repeter}
                onValueChange={setRepeter}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            {repeter && (
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                <View style={s.ligne}>
                  <Text variant="bodySmall" color="textSecondary" style={{ flex: 1 }}>{t('planningHoraires.editeur.jusquau')}</Text>
                  <Pressable
                    onPress={() => setDateOuverte((v) => !v)}
                    style={[s.heure, { backgroundColor: dateOuverte ? colors.primaryLight : colors.surfaceSecondary, borderRadius: radius.sm }]}
                  >
                    <Text variant="bodySmall" style={{ fontWeight: '600' }}>{format(finPeriode, { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  </Pressable>
                </View>
                {dateOuverte && (
                  <DateTimePicker
                    value={dateDe(finPeriode)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    minimumDate={dateDe(jour.jour)}
                    maximumDate={dateDe(ajouterJours(jour.jour, DUREE_MAX_HORAIRES_DATES_JOURS - 1))}
                    themeVariant="light"
                    onChange={(e, d) => {
                      if (Platform.OS === 'android') setDateOuverte(false);
                      if (d && e.type !== 'dismissed') setFinPeriode(jourLocalDe(d));
                    }}
                  />
                )}
                <View>
                  <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.xs }}>{t('planningHoraires.editeur.lesJours')}</Text>
                  <View style={[s.ligne, { gap: 6 }]}>
                    {LUNDI_A_DIMANCHE.map((j) => {
                      const choisi = joursChoisis.includes(j);
                      return (
                        <Pressable
                          key={j}
                          onPress={() => setJoursChoisis((js) => (choisi ? js.filter((x) => x !== j) : [...js, j]))}
                          style={[s.jourPuce, { borderRadius: radius.full, backgroundColor: choisi ? colors.primary : colors.surfaceSecondary }]}
                        >
                          <Text variant="caption" style={{ fontWeight: '700', color: choisi ? '#FFFFFF' : colors.textSecondary }}>{nomJour(j, 'narrow')}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <Text variant="caption" color="textMuted">
                  {t('planningHoraires.editeur.repeterResume', {
                    du: format(jour.jour, { day: 'numeric', month: 'short' }),
                    au: format(finPeriode, { day: 'numeric', month: 'short' }),
                  })}
                </Text>
              </View>
            )}
          </Card>

          <Button title={t('common.save')} onPress={enregistrer} loading={enregistre} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Copier une semaine sur les suivantes
// ---------------------------------------------------------------------------

function CopieSemaine({
  lundi,
  membre,
  providerId,
  confirmerConflits,
  onFermer,
  onCopie,
}: {
  lundi: string;
  membre: WithId<Member>;
  providerId: string;
  confirmerConflits: (c: AvailabilityConflict[]) => Promise<boolean>;
  onFermer: () => void;
  onCopie: (semaines: number) => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [n, setN] = useState(4);
  const [enCours, setEnCours] = useState(false);

  const du = ajouterJours(lundi, 7);
  const au = ajouterJours(du, n * 7 - 1);
  const court = (j: string) => format(j, { day: 'numeric', month: 'short' });

  const copier = async () => {
    if (!membre.locationId) {
      showToast({ variant: 'error', message: t('proAvailability.validation.noLocation') });
      return;
    }
    setEnCours(true);
    try {
      const p = { memberId: membre.id, locationId: membre.locationId, lundiSource: lundi, nombreDeSemaines: n };
      const apercu = await schedulingService.copierSemaineHoraires(providerId, p, { ecrire: false });
      if (!(await confirmerConflits(apercu.conflicts))) return;
      await schedulingService.copierSemaineHoraires(providerId, p);
      onCopie(n);
    } catch (err) {
      console.error('[planning] copie', err);
      showToast({ variant: 'error', message: t('planningHoraires.erreurEnregistrement') });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onFermer}>
      <View style={s.voile}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onFermer} />
        <View style={[s.feuille, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}>
          <Text variant="h3">{t('planningHoraires.copier.titre')}</Text>
          <Text variant="bodySmall" color="textSecondary" style={{ marginTop: spacing.xs }}>
            {t('planningHoraires.copier.source', { du: court(lundi), au: court(ajouterJours(lundi, 6)) })}
          </Text>

          <View style={[s.ligne, { justifyContent: 'center', marginVertical: spacing.xl, gap: spacing.lg }]}>
            <Pressable
              hitSlop={8}
              disabled={n <= 1}
              onPress={() => setN((x) => Math.max(1, x - 1))}
              style={[s.pas, { borderColor: colors.border, borderRadius: radius.full, opacity: n <= 1 ? 0.3 : 1 }]}
            >
              <Ionicons name="remove" size={20} color={colors.text} />
            </Pressable>
            <View style={{ alignItems: 'center', minWidth: 120 }}>
              <Text variant="h1">{n}</Text>
              <Text variant="caption" color="textSecondary">{t('planningHoraires.copier.semaines', { count: n })}</Text>
            </View>
            <Pressable
              hitSlop={8}
              disabled={n >= 12}
              onPress={() => setN((x) => Math.min(12, x + 1))}
              style={[s.pas, { borderColor: colors.border, borderRadius: radius.full, opacity: n >= 12 ? 0.3 : 1 }]}
            >
              <Ionicons name="add" size={20} color={colors.text} />
            </Pressable>
          </View>

          <Text variant="caption" color="textSecondary" align="center" style={{ marginBottom: spacing.lg }}>
            {t('planningHoraires.copier.resume', { du: court(du), au: court(au) })}
          </Text>
          <Button title={t('planningHoraires.copier.confirmer')} onPress={copier} loading={enCours} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  conteneur: { flex: 1 },
  entete: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pastille: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6 },
  point: { width: 8, height: 8, borderRadius: 4 },
  rangee: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  colonne: { flex: 1 },
  colonneCopie: { width: 22, alignItems: 'center', justifyContent: 'center' },
  case: { alignItems: 'center', justifyContent: 'center', paddingVertical: 5, minHeight: 42 },
  legende: { width: 14, height: 14, borderRadius: 4 },
  enteteFeuille: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1 },
  segments: { flexDirection: 'row', padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  heure: { paddingHorizontal: 14, paddingVertical: 8 },
  jourPuce: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  voile: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  feuille: { padding: 20 },
  pas: { width: 44, height: 44, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
