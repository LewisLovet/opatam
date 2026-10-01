'use client';

/**
 * Planning jour par jour — les horaires DATÉS d'un membre, sous sa semaine
 * type : fermer un jour, ouvrir une date, poser des horaires sur une
 * période, copier une semaine sur les suivantes ; et l'option « horaires
 * variables » (la semaine type ne s'applique plus, seuls les jours ouverts
 * ici sont réservables).
 *
 * Même service et même règle que l'écran « Planning » de l'app et que le
 * moteur de créneaux : ce qui s'affiche est ce qui se réserve.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Loader2, Plus, Repeat, Shuffle, Trash2 } from 'lucide-react';
import { schedulingService, type HorairesDatesInput, type JourDuPlanning, type PlanningHoraires } from '@booking-app/firebase';
import {
  ajouterJours,
  jourLocalDe,
  lundiDe,
  raisonHorairesDatesInvalides,
  MESSAGES_HORAIRES_DATES,
  DUREE_MAX_HORAIRES_DATES_JOURS,
} from '@booking-app/shared';
import type { AvailabilityConflict, DatedAvailability, DatedAvailabilityMode, Member, TimeSlot } from '@booking-app/shared';
import { Button, ConfirmDialog, Modal, ModalBody, ModalFooter, ModalHeader, Switch, useToast } from '@/components/ui';
import { TimeSlotInput } from './TimeSlotInput';

type WithId<T> = { id: string } & T;

const dateDe = (jour: string) => {
  const [a, m, j] = jour.split('-').map(Number);
  return new Date(a, m - 1, j);
};
const format = (jour: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', o).format(dateDe(jour));
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const LUNDI_A_DIMANCHE = [1, 2, 3, 4, 5, 6, 0];
const NOMS_COURTS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const INITIALES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const heureCourte = (hhmm: string) => {
  const [h, m] = hhmm.split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
};
const plageLisible = (p: TimeSlot) => `${p.start}–${p.end === '24:00' ? '00:00' : p.end}`;
const moisSuivant = (mois: string, n: number) => {
  const [a, m] = mois.split('-').map(Number);
  return jourLocalDe(new Date(a, m - 1 + n, 1)).slice(0, 7);
};
const SOURCES: Record<JourDuPlanning['source'], string> = {
  semaine: 'semaine type',
  date: 'réglé pour ce jour',
  variables: 'horaires variables',
};

interface Confirmation {
  titre: string;
  message: ReactNode;
  libelle: string;
  action: () => Promise<void>;
}

function ListeConflits({ conflits }: { conflits: AvailabilityConflict[] }) {
  if (conflits.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
      <p className="font-medium">
        {conflits.length} rendez-vous se retrouverai{conflits.length > 1 ? 'en' : ''}t hors des nouveaux horaires :
      </p>
      <ul className="mt-1 list-disc pl-5">
        {conflits.slice(0, 8).map((c) => (
          <li key={c.bookingId}>
            {c.clientName || '—'},{' '}
            {new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
              c.bookingDate instanceof Date ? c.bookingDate : new Date(c.bookingDate),
            )}
          </li>
        ))}
        {conflits.length > 8 && <li>… et {conflits.length - 8} autre{conflits.length - 8 > 1 ? 's' : ''}</li>}
      </ul>
      <p className="mt-1">Ils ne sont pas annulés : pensez à les déplacer ou à prévenir les personnes concernées.</p>
    </div>
  );
}

export function PlanningJourParJour({
  providerId,
  membre,
  onHorairesVariables,
}: {
  providerId: string;
  membre: WithId<Member>;
  /** Après la bascule de l'option : l'écran parent ajuste son avertissement. */
  onHorairesVariables?: (actif: boolean) => void;
}) {
  const toast = useToast();
  const aujourdhui = jourLocalDe(new Date());
  const [mois, setMois] = useState(aujourdhui.slice(0, 7));
  // Vue SEMAINE par défaut : une ligne par jour, ses plages en barres.
  const [vue, setVue] = useState<'semaine' | 'mois'>('semaine');
  const [lundi, setLundi] = useState(() => lundiDe(aujourdhui, ajouterJours));
  const [planning, setPlanning] = useState<PlanningHoraires | null>(null);
  const [chargement, setChargement] = useState(true);
  const [jourEdite, setJourEdite] = useState<JourDuPlanning | null>(null);
  const [lundiCopie, setLundiCopie] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [enCours, setEnCours] = useState(false);

  const { debut, fin } = useMemo(() => {
    if (vue === 'semaine') return { debut: lundi, fin: ajouterJours(lundi, 6) };
    const dernier = ajouterJours(`${moisSuivant(mois, 1)}-01`, -1);
    return { debut: lundiDe(`${mois}-01`, ajouterJours), fin: ajouterJours(lundiDe(dernier, ajouterJours), 6) };
  }, [mois, vue, lundi]);

  const charger = useCallback(async () => {
    try {
      setPlanning(await schedulingService.getPlanningHoraires(providerId, membre.id, debut, fin));
    } catch (err) {
      console.error('[planning] lecture', err);
      toast.error('Impossible de charger le planning');
    }
  }, [providerId, membre.id, debut, fin, toast]);

  useEffect(() => {
    setChargement(true);
    charger().finally(() => setChargement(false));
  }, [charger]);

  /** Sans rendez-vous touché : on agit. Sinon : on demande, liste à l'appui. */
  const agir = async (conflits: AvailabilityConflict[], c: Omit<Confirmation, 'message'> & { message?: ReactNode }, forcer = false) => {
    if (conflits.length === 0 && !forcer) {
      await c.action();
      return;
    }
    setConfirmation({
      ...c,
      message: (
        <>
          {c.message}
          <ListeConflits conflits={conflits} />
        </>
      ),
    });
  };

  const executer = async (action: () => Promise<void>, succes: string) => {
    setEnCours(true);
    try {
      await action();
      await charger();
      toast.success(succes);
    } catch (err) {
      console.error('[planning] écriture', err);
      toast.error(err instanceof Error && err.message ? err.message : "L'enregistrement a échoué");
    } finally {
      setEnCours(false);
      setConfirmation(null);
    }
  };

  const basculerVariables = async (actif: boolean) => {
    setEnCours(true);
    try {
      const { conflicts } = await schedulingService.setHorairesVariables(providerId, membre.id, actif, { ecrire: false });
      await agir(
        conflicts,
        {
          titre: actif ? 'Passer en horaires variables ?' : 'Revenir à la semaine type ?',
          message: actif
            ? `La semaine type de ${membre.name} ne s'appliquera plus : chaque jour sans horaires réglés ici sera fermé à la réservation.`
            : 'Les jours sans réglage reprendront les horaires de la semaine type.',
          libelle: 'Confirmer',
          action: () =>
            executer(
              async () => {
                await schedulingService.setHorairesVariables(providerId, membre.id, actif);
                onHorairesVariables?.(actif);
              },
              actif ? 'Horaires variables activés' : 'Semaine type rétablie',
            ),
        },
        true,
      );
    } catch (err) {
      console.error('[planning] horaires variables', err);
      toast.error("L'enregistrement a échoué");
    } finally {
      setEnCours(false);
    }
  };

  const supprimer = async (r: WithId<DatedAvailability>) => {
    try {
      const conflits = await schedulingService.conflitsSuppressionHorairesDates(providerId, r);
      await agir(
        conflits,
        {
          titre: 'Supprimer ce réglage ?',
          message: 'Les jours concernés reviendront à leurs horaires habituels (fermés, en horaires variables).',
          libelle: 'Supprimer',
          action: () => executer(() => schedulingService.supprimerHorairesDates(providerId, r.id), 'Réglage supprimé'),
        },
        true,
      );
    } catch (err) {
      console.error('[planning] suppression', err);
      toast.error('La suppression a échoué');
    }
  };

  const semaines = useMemo(() => {
    const jours = planning?.jours ?? [];
    const lignes: JourDuPlanning[][] = [];
    for (let i = 0; i < jours.length; i += 7) lignes.push(jours.slice(i, i + 7));
    return lignes;
  }, [planning]);
  const lundiCourant = lundiDe(aujourdhui, ajouterJours);
  const variables = planning?.horairesVariables === true;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 sm:p-5">
      <div className="flex items-start gap-3">
        <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white">Planning jour par jour</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Retouchez la semaine type date par date : fermer un jour, ouvrir un samedi, poser des horaires sur une période,
            copier une semaine.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-gray-50 px-3 py-3 dark:bg-gray-800/60">
        <div className="flex items-center gap-2">
          <Shuffle className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" />
          <div className="flex-1">
            <Switch
              label="Horaires variables"
              checked={variables}
              disabled={enCours || !planning}
              onChange={(e) => basculerVariables(e.target.checked)}
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {variables
            ? 'Activé : seuls les jours ouverts ici sont réservables, tous les autres sont fermés. La semaine type ci-dessus ne s’applique pas.'
            : 'Pour un planning qui change d’une semaine à l’autre : la semaine type ne s’applique plus, seuls les jours ouverts ici sont réservables.'}
        </p>
      </div>

      <div className="mt-4 inline-flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {(['semaine', 'mois'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVue(v)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              vue === v ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {v === 'semaine' ? 'Semaine' : 'Mois'}
          </button>
        ))}
      </div>

      {vue === 'semaine' && (
        chargement && !planning ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
          </div>
        ) : (
          <VueSemaine
            lundi={lundi}
            jours={(planning?.jours ?? []).filter((j) => j.jour >= lundi && j.jour <= ajouterJours(lundi, 6))}
            aujourdhui={aujourdhui}
            variables={variables}
            peutReculer={lundi > ajouterJours(lundiCourant, -7)}
            onPrecedente={() => setLundi((l) => ajouterJours(l, -7))}
            onSuivante={() => setLundi((l) => ajouterJours(l, 7))}
            onJour={setJourEdite}
            onCopier={() => setLundiCopie(lundi)}
          />
        )
      )}

      {vue === 'mois' && (
      <>
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          disabled={mois <= aujourdhui.slice(0, 7)}
          onClick={() => setMois((m) => moisSuivant(m, -1))}
          className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-semibold text-gray-900 dark:text-white">{majuscule(format(`${mois}-01`, { month: 'long', year: 'numeric' }))}</span>
        <button
          type="button"
          onClick={() => setMois((m) => moisSuivant(m, 1))}
          className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label="Mois suivant"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {chargement && !planning ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : (
        <div className="mt-2">
          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_28px] gap-1 text-center text-xs text-gray-400">
            {LUNDI_A_DIMANCHE.map((j) => (
              <span key={j}>
                <span className="sm:hidden">{INITIALES[j]}</span>
                <span className="hidden sm:inline">{NOMS_COURTS[j]}</span>
              </span>
            ))}
            <span />
          </div>
          {semaines.map((semaine) => {
            const lundi = semaine[0].jour;
            const copiable = lundi >= ajouterJours(lundiCourant, -7);
            return (
              <div key={lundi} className="mt-1 grid grid-cols-[repeat(7,minmax(0,1fr))_28px] gap-1">
                {semaine.map((j) => {
                  const horsMois = j.jour.slice(0, 7) !== mois;
                  const passe = j.jour < aujourdhui;
                  const regle = j.source === 'date';
                  return (
                    <button
                      key={j.jour}
                      type="button"
                      disabled={passe}
                      onClick={() => setJourEdite(j)}
                      title={`${format(j.jour, { weekday: 'long', day: 'numeric', month: 'long' })} — ${j.ouvert ? j.plages.map(plageLisible).join(', ') : 'fermé'} (${SOURCES[j.source]})`}
                      className={[
                        'flex min-h-[48px] flex-col items-center justify-center rounded-lg px-0.5 py-1 text-xs transition',
                        j.ouvert
                          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                          : 'bg-gray-50 text-gray-400 dark:bg-gray-800/60 dark:text-gray-500',
                        regle ? 'ring-2 ring-inset ring-primary-500' : j.jour === aujourdhui ? 'ring-1 ring-inset ring-gray-400' : '',
                        horsMois ? 'opacity-40' : passe ? 'opacity-50' : 'hover:brightness-95',
                        passe ? 'cursor-default' : 'cursor-pointer',
                      ].join(' ')}
                    >
                      <span className={`font-semibold ${j.jour === aujourdhui ? 'underline' : ''}`}>{Number(j.jour.slice(8))}</span>
                      <span className="truncate text-[10px] leading-tight">
                        {j.ouvert ? `${heureCourte(j.plages[0].start)}–${heureCourte(j.plages[j.plages.length - 1].end)}` : '—'}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={!copiable}
                  onClick={() => setLundiCopie(lundi)}
                  className={`flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-primary-600 dark:hover:bg-gray-800 ${copiable ? '' : 'invisible'}`}
                  title="Copier cette semaine sur les suivantes"
                  aria-label="Copier cette semaine sur les suivantes"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded bg-primary-50 ring-2 ring-inset ring-primary-500 dark:bg-primary-900/30" /> Réglé à la date
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded bg-primary-50 dark:bg-primary-900/30" /> {variables ? 'Ouvert' : 'Semaine type'}
            </span>
            <span>Cliquez un jour pour le modifier ; l’icône au bout d’une semaine la copie sur les suivantes.</span>
          </div>
        </div>
      )}
      </>
      )}

      {planning && planning.reglages.length > 0 && (
        <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Réglages en cours</p>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {planning.reglages.map((r) => {
              const periode =
                r.from === r.to
                  ? format(r.from, { weekday: 'short', day: 'numeric', month: 'short' })
                  : `du ${format(r.from, { day: 'numeric', month: 'short' })} au ${format(r.to, { day: 'numeric', month: 'short' })}`;
              const jours =
                r.weekdays.length > 0 && r.from !== r.to
                  ? LUNDI_A_DIMANCHE.filter((j) => r.weekdays.includes(j)).map((j) => NOMS_COURTS[j]).join(', ')
                  : '';
              const quoi = r.mode === 'slots' ? r.slots.map(plageLisible).join(', ') : r.mode === 'closed' ? 'Fermé' : 'Horaires habituels';
              return (
                <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{majuscule(periode)}</p>
                    <p className="text-gray-500 dark:text-gray-400">{jours ? `${jours} · ${quoi}` : quoi}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => supprimer(r)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                    aria-label="Supprimer ce réglage"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {jourEdite && (
        <EditeurJour
          jour={jourEdite}
          membre={membre}
          variables={variables}
          onFermer={() => setJourEdite(null)}
          onValider={async (input) => {
            const conflits = await schedulingService.conflitsHorairesDates(providerId, input);
            const ecrire = () =>
              executer(async () => {
                await schedulingService.setHorairesDates(providerId, input);
                setJourEdite(null);
              }, 'Horaires enregistrés');
            await agir(conflits, { titre: 'Enregistrer ces horaires ?', libelle: 'Enregistrer quand même', action: ecrire });
          }}
        />
      )}

      {lundiCopie && (
        <CopieSemaine
          lundi={lundiCopie}
          onFermer={() => setLundiCopie(null)}
          onValider={async (n) => {
            if (!membre.locationId) return;
            const p = { memberId: membre.id, locationId: membre.locationId, lundiSource: lundiCopie, nombreDeSemaines: n };
            const apercu = await schedulingService.copierSemaineHoraires(providerId, p, { ecrire: false });
            const copier = () =>
              executer(async () => {
                await schedulingService.copierSemaineHoraires(providerId, p);
                setLundiCopie(null);
              }, `Semaine copiée sur ${n} semaine${n > 1 ? 's' : ''}`);
            await agir(apercu.conflicts, { titre: 'Copier cette semaine ?', libelle: 'Copier quand même', action: copier });
          }}
        />
      )}

      <ConfirmDialog
        isOpen={confirmation !== null}
        onClose={() => setConfirmation(null)}
        onConfirm={() => confirmation?.action()}
        title={confirmation?.titre ?? ''}
        message={confirmation?.message ?? ''}
        confirmLabel={confirmation?.libelle}
        loading={enCours}
        variant="warning"
      />
    </section>
  );
}

const enMinutes = (hhmm: string, fin = false) => {
  const [h, m] = hhmm.split(':').map(Number);
  const v = h * 60 + m;
  return fin && v === 0 ? 24 * 60 : v;
};

/** Vue semaine : une ligne par jour, les plages en barres sur une frise horaire. */
function VueSemaine({
  lundi,
  jours,
  aujourdhui,
  variables,
  peutReculer,
  onPrecedente,
  onSuivante,
  onJour,
  onCopier,
}: {
  lundi: string;
  jours: JourDuPlanning[];
  aujourdhui: string;
  variables: boolean;
  peutReculer: boolean;
  onPrecedente: () => void;
  onSuivante: () => void;
  onJour: (j: JourDuPlanning) => void;
  onCopier: () => void;
}) {
  // 8 h – 20 h au moins, élargie aux plages de la semaine, à l'heure ronde.
  const { debut, fin, graduations } = useMemo(() => {
    let a = 8 * 60;
    let b = 20 * 60;
    for (const j of jours) {
      for (const p of j.plages) {
        a = Math.min(a, enMinutes(p.start));
        b = Math.max(b, enMinutes(p.end, true));
      }
    }
    a = Math.floor(a / 60) * 60;
    b = Math.min(24 * 60, Math.ceil(b / 60) * 60);
    const pas = b - a <= 12 * 60 ? 120 : 240;
    const g: number[] = [];
    for (let m = Math.ceil(a / pas) * pas; m <= b; m += pas) g.push(m);
    return { debut: a, fin: b, graduations: g };
  }, [jours]);
  const pct = (m: number) => `${((m - debut) / (fin - debut)) * 100}%`;
  const court = (j: string) => format(j, { day: 'numeric', month: 'short' });
  const vide = jours.length > 0 && jours.every((j) => !j.ouvert);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={!peutReculer}
          onClick={onPrecedente}
          className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label="Semaine précédente"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-semibold text-gray-900 dark:text-white">
          <span className="hidden sm:inline">Semaine du {court(lundi)} au {court(ajouterJours(lundi, 6))}</span>
          <span className="sm:hidden">
            {court(lundi)} – {court(ajouterJours(lundi, 6))}
          </span>
        </span>
        <button
          type="button"
          onClick={onSuivante}
          className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label="Semaine suivante"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-[64px_1fr] gap-x-3">
        <span />
        <div className="relative h-4 text-[10px] text-gray-400">
          {graduations.map((m) => (
            <span key={m} className="absolute -translate-x-1/2" style={{ left: pct(m) }}>
              {Math.floor(m / 60)}h
            </span>
          ))}
        </div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {jours.map((j) => {
          const passe = j.jour < aujourdhui;
          const estAujourdhui = j.jour === aujourdhui;
          return (
            <button
              key={j.jour}
              type="button"
              disabled={passe}
              onClick={() => onJour(j)}
              className={`grid w-full grid-cols-[64px_1fr] items-center gap-x-3 py-2 text-left transition ${
                passe ? 'cursor-default opacity-45' : 'rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              <span className="text-sm">
                <span className={`block font-semibold ${estAujourdhui ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-white'}`}>
                  {majuscule(NOMS_COURTS[dateDe(j.jour).getDay()])}
                </span>
                <span className="text-xs text-gray-500">{format(j.jour, { day: 'numeric', month: 'short' })}</span>
              </span>
              <span className="block min-w-0">
                <span className="relative block h-5 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                  {graduations.map((m) => (
                    <span key={m} className="absolute inset-y-0 w-px bg-gray-200 dark:bg-gray-700" style={{ left: pct(m) }} />
                  ))}
                  {j.plages.map((p, k) => {
                    const a = Math.max(debut, enMinutes(p.start));
                    const b = Math.min(fin, enMinutes(p.end, true));
                    return (
                      <span
                        key={k}
                        className="absolute inset-y-0.5 rounded bg-primary-500 dark:bg-primary-400"
                        style={{ left: pct(a), width: `${((b - a) / (fin - debut)) * 100}%` }}
                        title={plageLisible(p)}
                      />
                    );
                  })}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {j.source === 'date' && <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary-500" />}
                  {j.ouvert ? j.plages.map(plageLisible).join(', ') : 'Fermé'}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {vide && variables && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          Aucune disponibilité cette semaine : cliquez un jour pour l’ouvrir.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary-500" /> Réglé pour ce jour. Cliquez un jour pour le modifier.
        </span>
        <Button variant="outline" size="sm" leftIcon={<Copy className="h-4 w-4" />} onClick={onCopier}>
          Copier sur les semaines suivantes
        </Button>
      </div>
    </div>
  );
}

function EditeurJour({
  jour,
  membre,
  variables,
  onFermer,
  onValider,
}: {
  jour: JourDuPlanning;
  membre: WithId<Member>;
  variables: boolean;
  onFermer: () => void;
  onValider: (input: HorairesDatesInput) => Promise<void>;
}) {
  const [mode, setMode] = useState<DatedAvailabilityMode>(jour.ouvert ? 'slots' : 'closed');
  const [plages, setPlages] = useState<TimeSlot[]>(jour.ouvert ? jour.plages.map((p) => ({ ...p })) : [{ start: '09:00', end: '18:00' }]);
  const [repeter, setRepeter] = useState(false);
  const [fin, setFin] = useState(ajouterJours(jour.jour, 27));
  const [joursChoisis, setJoursChoisis] = useState<number[]>([jour.jourSemaine]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const modes: Array<{ id: DatedAvailabilityMode; libelle: string }> = [
    { id: 'slots', libelle: 'Ouvert' },
    { id: 'closed', libelle: 'Fermé' },
    ...(variables ? [] : [{ id: 'usual' as const, libelle: 'Horaires habituels' }]),
  ];

  const valider = async () => {
    if (!membre.locationId) {
      setErreur("Ce membre n'a pas de lieu assigné");
      return;
    }
    const input: HorairesDatesInput = {
      memberId: membre.id,
      locationId: membre.locationId,
      from: jour.jour,
      to: repeter ? fin : jour.jour,
      weekdays: repeter ? joursChoisis : [],
      mode,
      // Une fin à « 00:00 » = minuit, fin de journée.
      slots: mode === 'slots' ? plages.map((p) => ({ start: p.start, end: p.end === '00:00' ? '24:00' : p.end })) : [],
    };
    const raison = raisonHorairesDatesInvalides(input);
    if (raison || (repeter && joursChoisis.length === 0)) {
      setErreur(raison ? MESSAGES_HORAIRES_DATES[raison] : 'Choisissez au moins un jour de la semaine');
      return;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      await onValider(input);
    } catch (err) {
      console.error('[planning] aperçu', err);
      setErreur("L'enregistrement a échoué");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modal isOpen onClose={onFermer}>
      <ModalHeader title={majuscule(format(jour.jour, { weekday: 'long', day: 'numeric', month: 'long' }))} onClose={onFermer} />
      <ModalBody className="space-y-4">
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
          Actuellement : {jour.ouvert ? jour.plages.map(plageLisible).join(', ') : 'fermé'} ({SOURCES[jour.source]})
        </p>

        <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition ${
                mode === m.id ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {m.libelle}
            </button>
          ))}
        </div>

        {mode === 'slots' && (
          <div className="space-y-2">
            {plages.map((p, i) => (
              <TimeSlotInput
                key={i}
                start={p.start}
                end={p.end === '24:00' ? '00:00' : p.end}
                onChange={(start, end) => setPlages((ps) => ps.map((x, k) => (k === i ? { start, end } : x)))}
                onRemove={() => setPlages((ps) => ps.filter((_, k) => k !== i))}
                showRemove={plages.length > 1}
              />
            ))}
            {plages.length < 4 && (
              <button
                type="button"
                onClick={() => setPlages((ps) => [...ps, { start: ps[ps.length - 1]?.end ?? '14:00', end: '22:00' }])}
                className="flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
              >
                <Plus className="h-4 w-4" /> Ajouter une plage
              </button>
            )}
          </div>
        )}
        {mode === 'usual' && <p className="text-sm text-gray-500 dark:text-gray-400">Ce jour reprend les horaires de la semaine type.</p>}

        <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
            <input type="checkbox" checked={repeter} onChange={(e) => setRepeter(e.target.checked)} className="h-4 w-4 rounded" />
            <Repeat className="h-4 w-4 text-primary-600 dark:text-primary-400" /> Appliquer sur une période
          </label>
          {repeter && (
            <div className="mt-3 space-y-3">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                Jusqu’au
                <input
                  type="date"
                  value={fin}
                  min={jour.jour}
                  max={ajouterJours(jour.jour, DUREE_MAX_HORAIRES_DATES_JOURS - 1)}
                  onChange={(e) => e.target.value && setFin(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {LUNDI_A_DIMANCHE.map((j) => {
                  const choisi = joursChoisis.includes(j);
                  return (
                    <button
                      key={j}
                      type="button"
                      onClick={() => setJoursChoisis((js) => (choisi ? js.filter((x) => x !== j) : [...js, j]))}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        choisi ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {NOMS_COURTS[j]}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500">
                Du {format(jour.jour, { day: 'numeric', month: 'short' })} au {format(fin, { day: 'numeric', month: 'short' })}, les jours
                choisis.
              </p>
            </div>
          )}
        </div>
        {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onFermer}>
          Annuler
        </Button>
        <Button onClick={valider} loading={envoi}>
          Enregistrer
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function CopieSemaine({ lundi, onFermer, onValider }: { lundi: string; onFermer: () => void; onValider: (n: number) => Promise<void> }) {
  const [n, setN] = useState(4);
  const [envoi, setEnvoi] = useState(false);
  const du = ajouterJours(lundi, 7);
  const au = ajouterJours(du, n * 7 - 1);
  const court = (j: string) => format(j, { day: 'numeric', month: 'short' });
  return (
    <Modal isOpen onClose={onFermer}>
      <ModalHeader title="Copier cette semaine" onClose={onFermer} />
      <ModalBody className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Semaine du {court(lundi)} au {court(ajouterJours(lundi, 6))}, telle qu’elle s’applique.
        </p>
        <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200">
          Sur les
          <select
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          semaine{n > 1 ? 's' : ''} suivante{n > 1 ? 's' : ''}
        </label>
        <p className="text-xs text-gray-500">
          Les horaires seront reproduits du {court(du)} au {court(au)}, par-dessus ce qui était réglé sur ces dates.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onFermer}>
          Annuler
        </Button>
        <Button
          loading={envoi}
          onClick={async () => {
            setEnvoi(true);
            try {
              await onValider(n);
            } finally {
              setEnvoi(false);
            }
          }}
        >
          Copier
        </Button>
      </ModalFooter>
    </Modal>
  );
}
