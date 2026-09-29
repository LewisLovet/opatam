/**
 * Socle horaire : convertir entre heures LOCALES et instants absolus.
 *
 * ── Pourquoi ce fichier existe ──────────────────────────────────────────
 * Les horaires configurés par un prestataire sont des heures murales
 * (« 08:00 »). Les rendez-vous, eux, sont des instants absolus. Passer de
 * l'un à l'autre demande un fuseau, et aujourd'hui le code ne le demande
 * jamais : `generateTimeSlots` fait `setHours()`, donc le résultat dépend
 * du fuseau de la MACHINE qui exécute. Le même salon produit trois
 * résultats différents selon qu'on passe par le serveur web (forcé sur
 * Europe/Paris), le navigateur du pro, ou son téléphone.
 *
 * ── Pourquoi PAS `instantLocal()` de `apps/web/lib/ecran.ts` ────────────
 * Cet helper échantillonne le décalage à « l'heure murale traitée comme de
 * l'UTC ». En Europe la bascule d'heure d'été a lieu à 01:00 UTC, avant
 * toute heure d'ouverture, donc il tombe juste. Aux États-Unis elle a lieu
 * à 07:00 UTC, en pleine matinée : mesuré sur le dimanche 8 mars 2026 à
 * New York, il décale d'une heure TOUTES les demandes de 02:00 à 06:59 —
 * des heures parfaitement valides. Il marche en Europe par chance sur
 * l'heure de bascule, pas par conception.
 *
 * ── Ce que ce socle garantit ────────────────────────────────────────────
 * Chaque conversion est VALIDÉE par aller-retour : on reformate l'instant
 * candidat dans le fuseau et on vérifie qu'il redonne l'heure demandée.
 * Les deux cas que cela révèle ne sont pas des erreurs à masquer, ce sont
 * des états que l'appelant doit traiter :
 *   - `inexistante` — l'heure est sautée au passage à l'heure d'été ;
 *   - `ambigue`     — l'heure existe DEUX fois au retour à l'heure d'hiver.
 * D'où `resoudreHeureLocale`, qui les nomme, plutôt qu'une fonction qui
 * rend une date en choisissant en silence.
 *
 * ── Portée ──────────────────────────────────────────────────────────────
 * Zéro dépendance, zéro accès au fuseau de la machine : tout passe par
 * `Intl`, présent sur Node, les navigateurs et Hermes. Les Cloud Functions
 * ne peuvent pas importer `@booking-app/shared` à l'exécution (voir la
 * note du dossier `functions/src/lib`) : le jour où elles en auront besoin,
 * ce fichier se recopie tel quel, il ne dépend de rien.
 */

import type { HorlogeLocale } from './recurrence';

/** Une journée calendaire, « YYYY-MM-DD ». */
export type JourCalendaire = string;

/**
 * Ce qu'une heure murale vaut dans un fuseau donné.
 *
 * `exacte` est le cas de tous les jours. Les deux autres n'arrivent que
 * deux dimanches par an, mais ils arrivent — et c'est précisément là que
 * les moteurs de réservation produisent des rendez-vous fantômes.
 */
export type ResolutionLocale =
  | { etat: 'exacte'; instant: Date }
  | {
      /** L'heure demandée n'existe pas ce jour-là (passage à l'heure d'été). */
      etat: 'inexistante';
      /** De combien de minutes l'horloge a sauté (60 en général). */
      sautMinutes: number;
      /** L'instant où l'horloge locale reprend, pour l'expliquer à l'écran. */
      instantApresSaut: Date;
    }
  | {
      /** L'heure demandée existe deux fois (retour à l'heure d'hiver). */
      etat: 'ambigue';
      /** La première occurrence — encore à l'heure d'été. */
      premiere: Date;
      /** La seconde occurrence — déjà à l'heure d'hiver. */
      seconde: Date;
    };

/** Politique à appliquer quand une heure murale existe deux fois. */
export type ChoixAmbigu = 'premiere' | 'seconde';

const MINUTE = 60_000;
const JOUR_MS = 24 * 60 * MINUTE;

/**
 * Un identifiant IANA, et RIEN d'autre.
 *
 * `Intl` accepte aussi les décalages bruts (`"+04:00"` passe, vérifié) —
 * or un décalage ne connaît pas les changements d'heure : stocké sur un
 * lieu, il produirait exactement le bug qu'on corrige, six mois plus tard.
 * On les refuse donc explicitement.
 *
 * Retourne la forme canonique (`"europe/paris"` → `"Europe/Paris"`), ou
 * `null`. Un `null` doit être REMONTÉ comme anomalie, jamais remplacé par
 * un fuseau par défaut : c'est ce réflexe-là qui a mis « Europe/Paris »
 * sur les prestataires portugais.
 */
export function normaliserFuseau(valeur: string | null | undefined): string | null {
  if (typeof valeur !== 'string') return null;
  const brut = valeur.trim();
  // Doit commencer par une lettre : écarte "+04:00" et "-0500".
  if (!/^[A-Za-z]/.test(brut)) return null;
  // Aucun « + » : écarte "UTC+4".
  if (brut.includes('+')) return null;
  // Un tiret SUIVI D'UN CHIFFRE est un décalage déguisé ("Etc/GMT-4",
  // "UTC-5"). Un tiret suivi de lettres appartient au nom du lieu :
  // `America/Port-au-Prince` est un fuseau IANA parfaitement valide, et
  // la règle précédente — « aucun tiret » — le refusait.
  if (/-\d/.test(brut)) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: brut }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/** Raccourci booléen de `normaliserFuseau`. */
export function estFuseauValide(valeur: string | null | undefined): boolean {
  return normaliserFuseau(valeur) !== null;
}

interface PartiesLocales {
  annee: number;
  mois: number;
  jour: number;
  heure: number;
  minute: number;
  seconde: number;
}

/**
 * UN formateur par fuseau, construit une fois puis réutilisé.
 *
 * Construire un `Intl.DateTimeFormat` coûte cher — il charge les données de
 * fuseau et de langue — alors que `formatToParts` sur un formateur existant
 * est quasi gratuit. `partiesLocales` en construisait un NEUF à chaque appel,
 * et le moteur de créneaux l'appelle plusieurs fois par créneau candidat et
 * par blocage : sur un agenda ouvert 7 j/7 de 06:00 à 23:45, réservable à
 * 180 jours et chargé de 169 blocages (Kamerleon Production), des millions
 * de constructions — plus de deux minutes pour afficher un calendrier.
 *
 * Même formateur, mêmes options, même résultat : seule la construction est
 * mise en commun. Un fuseau invalide lève toujours à la construction, et
 * n'entre donc jamais dans le cache.
 */
const FORMATEURS = new Map<string, Intl.DateTimeFormat>();
function formateurDe(fuseau: string): Intl.DateTimeFormat {
  let f = FORMATEURS.get(fuseau);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: fuseau,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    FORMATEURS.set(fuseau, f);
  }
  return f;
}

/**
 * L'horloge murale d'un instant dans un fuseau.
 *
 * `formatToParts` et non `toLocaleString` : la seconde forme produit une
 * chaîne qu'il faut reparser, et ce reparsage dépend du format régional et
 * du fuseau de la machine. On lit les champs, on ne devine rien.
 */
function partiesLocales(instant: Date, fuseau: string): PartiesLocales {
  const parts = formateurDe(fuseau).formatToParts(instant);

  const champs: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') champs[p.type] = p.value;

  return {
    annee: Number(champs.year),
    mois: Number(champs.month),
    jour: Number(champs.day),
    heure: Number(champs.hour),
    minute: Number(champs.minute),
    seconde: Number(champs.second),
  };
}

/** L'horloge murale, exprimée comme si elle était de l'UTC. Sert de repère. */
function murCommeUtc(p: PartiesLocales): number {
  const ms = Date.UTC(2000, p.mois - 1, p.jour, p.heure, p.minute, p.seconde);
  // `Date.UTC` ramène les années < 100 dans les années 1900 : on pose
  // l'année à part pour que l'an 0042 d'un test ne devienne pas 1942.
  const d = new Date(ms);
  d.setUTCFullYear(p.annee);
  return d.getTime();
}

/**
 * Décalage du fuseau À CET INSTANT PRÉCIS, en millisecondes.
 * Positif à l'est de Greenwich. `Indian/Reunion` vaut toujours +4 h,
 * `America/New_York` -5 h ou -4 h selon la saison.
 */
export function decalageA(instant: Date, fuseau: string): number {
  const aLaSeconde = Math.floor(instant.getTime() / 1000) * 1000;
  return murCommeUtc(partiesLocales(instant, fuseau)) - aLaSeconde;
}

/** « YYYY-MM-DD » d'un instant, dans le fuseau donné. */
export function jourLocal(instant: Date, fuseau: string): JourCalendaire {
  const p = partiesLocales(instant, fuseau);
  return `${String(p.annee).padStart(4, '0')}-${String(p.mois).padStart(2, '0')}-${String(p.jour).padStart(2, '0')}`;
}

/** « HH:mm » d'un instant, dans le fuseau donné. */
export function heureLocale(instant: Date, fuseau: string): string {
  const p = partiesLocales(instant, fuseau);
  return `${String(p.heure).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** Minutes écoulées depuis minuit local (0–1439). */
export function minutesLocales(instant: Date, fuseau: string): number {
  const p = partiesLocales(instant, fuseau);
  return p.heure * 60 + p.minute;
}

/**
 * Jour de la semaine d'une date calendaire — 0 = dimanche.
 *
 * Aucun fuseau : « le mardi 23 » est un mardi partout. C'est ce qu'il faut
 * pour choisir les horaires d'ouverture d'un jour donné, là où
 * `new Date(...).getDay()` répond dans le fuseau de la machine.
 */
export function jourSemaineCalendaire(jour: JourCalendaire): number {
  const d = decouperJour(jour);
  if (!d) throw new Error(`Date calendaire invalide : « ${jour} » (attendu YYYY-MM-DD)`);
  const base = new Date(Date.UTC(2000, d.m - 1, d.j));
  base.setUTCFullYear(d.a, d.m - 1, d.j);
  return base.getUTCDay();
}

/** Jour de la semaine local — 0 = dimanche, comme partout dans le code. */
export function jourSemaineLocal(instant: Date, fuseau: string): number {
  const p = partiesLocales(instant, fuseau);
  return new Date(Date.UTC(p.annee, p.mois - 1, p.jour)).getUTCDay();
}

/** Découpe « YYYY-MM-DD ». Renvoie `null` si la forme n'est pas celle-là. */
function decouperJour(jour: JourCalendaire): { a: number; m: number; j: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour);
  if (!m) return null;
  const a = Number(m[1]);
  const mo = Number(m[2]);
  const j = Number(m[3]);
  if (mo < 1 || mo > 12 || j < 1 || j > 31) return null;
  // La date existe-t-elle VRAIMENT ? « 2026-02-31 » passait le contrôle,
  // puis JavaScript le normalisait en mars sans rien dire — un décalage
  // d'un mois, silencieux, à partir d'une simple faute de frappe.
  const controle = new Date(Date.UTC(2000, mo - 1, j));
  controle.setUTCFullYear(a, mo - 1, j);
  if (controle.getUTCMonth() !== mo - 1 || controle.getUTCDate() !== j) return null;
  return { a, m: mo, j };
}

/**
 * Décale une date calendaire de N jours.
 *
 * Arithmétique de CALENDRIER, volontairement sans fuseau : « demain » est
 * une notion de date, pas de durée. Ajouter 24 h à un instant donne le
 * mauvais jour deux fois par an ; ajouter 1 ici ne se trompe jamais.
 */
export function ajouterJours(jour: JourCalendaire, n: number): JourCalendaire {
  const d = decouperJour(jour);
  if (!d) throw new Error(`Date calendaire invalide : « ${jour} » (attendu YYYY-MM-DD)`);
  const base = new Date(Date.UTC(2000, d.m - 1, d.j + n));
  base.setUTCFullYear(d.a, d.m - 1, d.j + n);
  return jourLocal(base, 'UTC');
}

/**
 * Que vaut « ce jour-là, à cette minute » dans ce fuseau ?
 *
 * Deux candidats sont calculés — l'un avec le décalage d'avant la bascule,
 * l'autre avec celui d'après — puis chacun est VÉRIFIÉ en le reformatant
 * dans le fuseau. Seul un candidat qui redonne exactement l'heure demandée
 * est retenu. C'est cet aller-retour qui distingue les trois états au lieu
 * de rendre une date plausible mais fausse.
 *
 * `minutes` peut dépasser 1439 : 1440 vaut « minuit au bout de la
 * journée », ce que le code appelle déjà une fin de plage à « 00:00 ».
 */
export function resoudreHeureLocale(
  jour: JourCalendaire,
  minutes: number,
  fuseau: string,
): ResolutionLocale {
  const d = decouperJour(jour);
  if (!d) throw new Error(`Date calendaire invalide : « ${jour} » (attendu YYYY-MM-DD)`);
  const zone = normaliserFuseau(fuseau);
  if (!zone) throw new Error(`Fuseau IANA invalide : « ${fuseau} »`);

  const repere = murCommeUtc({
    annee: d.a,
    mois: d.m,
    jour: d.j,
    heure: 0,
    minute: 0,
    seconde: 0,
  }) + minutes * MINUTE;

  // Les décalages possibles autour de cette date. On sonde la VEILLE et le
  // LENDEMAIN, pas seulement le jour même : une bascule tombe forcément
  // entre les deux, et sonder deux fois du même côté rate l'heure qui
  // existe deux fois — les deux sondes rendent alors le même décalage et
  // l'heure doublée passe pour une heure ordinaire.
  const decalages = [
    decalageA(new Date(repere - JOUR_MS), zone),
    decalageA(new Date(repere), zone),
    decalageA(new Date(repere + JOUR_MS), zone),
  ];

  const valides: Date[] = [];
  for (const decalage of decalages) {
    const candidat = new Date(repere - decalage);
    // L'aller-retour : ce candidat se reformate-t-il en l'heure demandée ?
    if (murCommeUtc(partiesLocales(candidat, zone)) !== repere) continue;
    if (valides.some((v) => v.getTime() === candidat.getTime())) continue;
    valides.push(candidat);
  }

  if (valides.length === 1) return { etat: 'exacte', instant: valides[0] };

  if (valides.length >= 2) {
    valides.sort((a, b) => a.getTime() - b.getTime());
    return { etat: 'ambigue', premiere: valides[0], seconde: valides[1] };
  }

  // Aucun candidat ne se reformate en l'heure demandée : l'horloge locale
  // a sauté par-dessus. On rend le saut et l'instant où elle reprend —
  // de quoi l'expliquer sans avoir à le recalculer ailleurs.
  const sautMs = Math.max(...decalages) - Math.min(...decalages) || 60 * MINUTE;
  return {
    etat: 'inexistante',
    sautMinutes: Math.round(sautMs / MINUTE),
    instantApresSaut: new Date(repere - Math.min(...decalages)),
  };
}

/**
 * La même chose, mais en appliquant une politique et en rendant une date.
 *
 * `null` pour une heure qui n'existe pas : c'est la règle retenue — aucun
 * créneau n'est proposé à une heure que l'horloge saute. L'appelant DOIT
 * traiter ce `null` ; c'est le prix pour ne plus produire de rendez-vous
 * à une heure qui n'a jamais existé.
 *
 * Pour une heure doublée, `premiere` par défaut : c'est l'occurrence
 * encore à l'heure d'été, donc la plus tôt dans le temps réel, et celle
 * que choisissent les agendas courants. Le choix est explicite, il n'est
 * plus subi.
 */
export function instantDepuisHeureLocale(
  jour: JourCalendaire,
  minutes: number,
  fuseau: string,
  options: { ambigu?: ChoixAmbigu } = {},
): Date | null {
  const r = resoudreHeureLocale(jour, minutes, fuseau);
  if (r.etat === 'exacte') return r.instant;
  if (r.etat === 'inexistante') return null;
  return options.ambigu === 'seconde' ? r.seconde : r.premiere;
}

/**
 * Le premier instant d'une journée locale.
 *
 * Minuit n'existe pas partout tous les jours — quelques fuseaux basculent
 * à 00:00 (l'Amérique du Sud surtout). On prend alors l'instant où
 * l'horloge reprend, qui est bien le début de cette journée-là.
 */
export function debutDeJourLocal(jour: JourCalendaire, fuseau: string): Date {
  const r = resoudreHeureLocale(jour, 0, fuseau);
  if (r.etat === 'exacte') return r.instant;
  if (r.etat === 'inexistante') return r.instantApresSaut;
  return r.premiere;
}

/**
 * Bornes UTC d'une journée locale, prêtes pour une requête Firestore.
 *
 * La fin est « début du jour suivant moins 1 ms », jamais « début + 24 h » :
 * une journée de bascule dure 23 ou 25 heures.
 */
export function bornesDeJourLocal(
  jour: JourCalendaire,
  fuseau: string,
): { debut: Date; fin: Date } {
  const debut = debutDeJourLocal(jour, fuseau);
  const debutSuivant = debutDeJourLocal(ajouterJours(jour, 1), fuseau);
  return { debut, fin: new Date(debutSuivant.getTime() - 1) };
}

/**
 * Durée RÉELLE d'une journée locale, en minutes : 1440 d'habitude, 1380 au
 * passage à l'heure d'été, 1500 au retour à l'heure d'hiver.
 *
 * Sert à dire au prestataire que sa capacité change ces deux jours-là :
 * une boucle sur des minutes murales génère toujours le même nombre de
 * créneaux, alors que la journée, elle, a gagné ou perdu une heure.
 */
export function dureeDuJourLocal(jour: JourCalendaire, fuseau: string): number {
  const { debut } = bornesDeJourLocal(jour, fuseau);
  const debutSuivant = debutDeJourLocal(ajouterJours(jour, 1), fuseau);
  return Math.round((debutSuivant.getTime() - debut.getTime()) / MINUTE);
}

/** Une journée locale dure-t-elle autre chose que 24 h ? */
export function estJourDeBascule(jour: JourCalendaire, fuseau: string): boolean {
  return dureeDuJourLocal(jour, fuseau) !== JOUR_MS / MINUTE;
}

/**
 * L'horloge de ce fuseau, pour le générateur de récurrences.
 *
 * `recurrence.ts` ne dépend de rien — c'est ce qui le rend chargeable tel
 * quel et lisible d'un bout à l'autre. Le fuseau y entre par une
 * `HorlogeLocale`, fabriquée ici : les deux cas qui comptent vraiment —
 * l'heure qui n'existe pas, celle qui existe deux fois — restent traités à
 * l'endroit qui sait les traiter, juste au-dessus.
 *
 * Le type est importé en `import type` : il disparaît à la compilation, et
 * ce fichier garde donc zéro dépendance à l'exécution.
 */
export function horlogeDuFuseau(fuseau: string | null | undefined): HorlogeLocale | undefined {
  if (!fuseau) return undefined;
  return {
    jour: (d: Date) => jourLocal(d, fuseau),
    minutes: (d: Date) => minutesLocales(d, fuseau),
    instant: (jour: JourCalendaire, minutes: number) => {
      const r = resoudreHeureLocale(jour, minutes, fuseau);
      if (r.etat === 'exacte') return r.instant;
      // On ne SAUTE pas l'occurrence : une absence qui disparaît du planning
      // est pire qu'une absence décalée d'une heure. Heure inexistante →
      // l'instant où l'horloge reprend ; heure doublée → la première,
      // comme partout ailleurs dans le moteur.
      if (r.etat === 'inexistante') return r.instantApresSaut;
      return r.premiere;
    },
  };
}

/**
 * L'instant d'une heure SAISIE dans un formulaire, pour un lieu donné.
 *
 * C'est le point où tout se joue. Les formulaires construisaient leur date
 * avec `new Date(a, m, j, h, min)` ou `setHours(...)` : l'instant obtenu
 * est celui de l'APPAREIL. Un pro à Paris qui bloque « 09:00 » pour son
 * salon de Los Angeles produisait un blocage à minuit là-bas — et le
 * moteur, lui, lit bien dans le fuseau du lieu. Les deux bouts ne parlaient
 * pas de la même heure.
 *
 * Avec `fuseau`, l'heure murale est celle du SALON. Sans (fuseau inconnu),
 * on retombe exactement sur l'ancien comportement : même appareil, même
 * résultat.
 *
 * `minutes` peut valoir 1440 (« minuit au bout de la journée »), comme
 * partout dans le moteur ; c'est alors le début du jour suivant.
 */
export function instantSaisi(
  jour: JourCalendaire,
  minutes: number,
  fuseau?: string | null,
): Date {
  const d = decouperJour(jour);
  if (!d) throw new Error(`Date calendaire invalide : « ${jour} » (attendu YYYY-MM-DD)`);
  if (!fuseau) {
    return new Date(d.a, d.m - 1, d.j, Math.floor(minutes / 60), minutes % 60, 0, 0);
  }
  const horloge = horlogeDuFuseau(fuseau);
  return horloge!.instant(jour, minutes);
}

/** « 2026-05-03 » depuis un `Date`, par ses composantes de l'APPAREIL. */
export function jourDeLAppareil(d: Date): JourCalendaire {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${j}`;
}

/**
 * Ce qu'un formulaire SAISIT : des jours et des heures murales, sans fuseau.
 *
 * C'est la seule forme qui ait un sens avant de savoir POUR QUI on écrit.
 * « Fermé samedi de 09:00 à 12:00 » pour un membre à Paris et un autre à
 * New York, ce sont deux instants différents : 09:00 dans chacun des deux
 * lieux. Construire l'instant une fois, dans le fuseau du premier membre,
 * puis l'envoyer à toute l'équipe, décalait tous les autres.
 */
export interface SaisieMurale {
  jourDebut: JourCalendaire;
  jourFin: JourCalendaire;
  /** « HH:mm ». Sans objet quand `allDay`. */
  heureDebut: string;
  heureFin: string;
  allDay: boolean;
}

function minutesDe(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * La période d'UN membre : la saisie, résolue dans le fuseau de SON lieu.
 * Journée entière = 00:00 → 23:59, comme les formulaires l'ont toujours
 * écrit (le moteur ne lit alors que les jours). Sans fuseau : l'appareil,
 * comme avant.
 */
export function periodeDepuisSaisie(
  s: SaisieMurale,
  fuseau?: string | null,
): { startDate: Date; endDate: Date } {
  const debut = s.allDay ? 0 : minutesDe(s.heureDebut);
  const fin = s.allDay ? 23 * 60 + 59 : minutesDe(s.heureFin);
  return {
    startDate: instantSaisi(s.jourDebut, debut, fuseau),
    endDate: instantSaisi(s.jourFin, fin, fuseau),
  };
}

/**
 * L'inverse : ce qu'il faut AFFICHER dans le formulaire pour une période
 * enregistrée, lue dans le fuseau de son lieu.
 *
 * Les formulaires relisaient l'instant avec les getters de l'APPAREIL : une
 * activité à 09:00 à Los Angeles s'ouvrait à 18:00 depuis Paris — et un
 * simple « Enregistrer » sans rien toucher la réécrivait à 18:00 là-bas.
 *
 * Les heures FIGÉES (`startTime`/`endTime`) priment : ce sont elles que le
 * moteur lit, donc elles disent vrai même pour une période créée avant que
 * la saisie ne suive le fuseau du lieu. Le JOUR, lui, vient toujours de
 * l'instant, lu dans le fuseau du lieu — c'est aussi ce que fait le moteur.
 */
export function saisieDepuisPeriode(
  p: {
    startDate: Date;
    endDate: Date;
    allDay: boolean;
    startTime?: string | null;
    endTime?: string | null;
  },
  fuseau?: string | null,
): SaisieMurale {
  const jour = (d: Date) => (fuseau ? jourLocal(d, fuseau) : jourDeLAppareil(d));
  const heure = (d: Date) =>
    fuseau
      ? heureLocale(d, fuseau)
      : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return {
    jourDebut: jour(p.startDate),
    jourFin: jour(p.endDate),
    heureDebut: p.startTime || heure(p.startDate),
    heureFin: p.endTime || heure(p.endDate),
    allDay: p.allDay,
  };
}

/**
 * Les fuseaux d'une sélection de membres sont-ils TOUS connus ?
 *
 * Une table `memberId → fuseau | null` se remplit de façon asynchrone.
 * « Absent de la table » = lecture EN COURS ; `null` = lecture faite, lieu
 * sans fuseau (vieux lieux — on retombe alors sur l'appareil, et c'est
 * voulu : on ne bloque pas un compte pour une donnée qu'il n'a pas).
 * Confondre les deux, c'était laisser partir un enregistrement avant la
 * réponse, donc dans le fuseau de l'appareil.
 */
export function fuseauxPrets(
  memberIds: string[],
  table: Record<string, string | null>,
): boolean {
  return memberIds.every((id) => Object.prototype.hasOwnProperty.call(table, id));
}

/** Les fuseaux distincts d'une sélection — plusieurs = l'heure varie selon le lieu. */
export function fuseauxDistincts(
  memberIds: string[],
  table: Record<string, string | null>,
): string[] {
  return Array.from(new Set(memberIds.map((id) => table[id]).filter((tz): tz is string => !!tz)));
}
