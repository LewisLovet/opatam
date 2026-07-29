/**
 * In-app store review prompt (App Store / Play Store natif).
 *
 * Appelé aux « moments positifs ». Côté CLIENT : résa confirmée, avis 4-5
 * étoiles déposé. Côté PRO : nouvelle réservation découverte dans son
 * planning (du chiffre qui tombe), et consultation de ses avis quand la note
 * est flatteuse.
 *
 * Pourquoi la DÉCOUVERTE d'une résa et non son acceptation : le bouton
 * « Confirmer » n'apparaît que si le prestataire a activé la confirmation
 * manuelle (`settings.requiresConfirmation`), ce que personne n'a fait —
 * les réservations naissent `confirmed`. Un déclencheur sur l'acceptation
 * ne se serait donc jamais déclenché.
 *
 * Le prompt n'est demandé que si :
 *   - au moins `minEvents` moments positifs cumulés,
 *   - pas de demande dans les COOLDOWN_DAYS derniers jours.
 * L'OS garde de toute façon le dernier mot (iOS plafonne à ~3 affichages/an
 * et ne dit jamais si la popup a réellement été montrée).
 *
 * Le seuil est PLUS HAUT côté pro : un salon actif reçoit des réservations
 * tous les jours, alors qu'une cliente ne réserve que de temps en temps.
 * Sans ça, un prestataire chargé brûlerait sa fenêtre de 120 jours en une
 * semaine, avant même de s'être fait une opinion de l'app.
 *
 * Le compteur est COMMUN aux deux rôles (un pro réserve aussi chez ses
 * confrères) ; c'est le seuil du moment déclencheur qui s'applique.
 *
 * IMPORTANT (OTA) : expo-store-review est un module NATIF présent seulement
 * à partir du build 1.6.0. Ce fichier part aussi en OTA vers des binaires
 * plus anciens — d'où le require() paresseux sous try/catch : sur un vieux
 * binaire l'appel est simplement un no-op, jamais un crash.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { decideNewBookingMoment } from './newBookingWatermark';

const STORAGE_KEY = '@opatam/store_review';
/** Repère « dernière résa vue » du planning pro — voir `recordNewBookingSeen…`. */
const LAST_SEEN_BOOKING_KEY = '@opatam/pro_last_seen_booking';
const MIN_POSITIVE_EVENTS = 2;
const COOLDOWN_DAYS = 120;
const PROMPT_DELAY_MS = 1500; // laisse le toast de succès / la navigation se poser

/** Seuil côté pro — voir l'en-tête : gestes plus fréquents, barre plus haute. */
export const PRO_MIN_POSITIVE_EVENTS = 3;

/**
 * Note à partir de laquelle consulter ses avis est un bon moment : le pro
 * regarde une réussite. En dessous, la demande tomberait au pire instant.
 * Le nombre minimum d'avis évite qu'un unique 5 étoiles fasse une moyenne.
 */
export const PRO_FLATTERING_AVERAGE = 4.5;
export const PRO_MIN_REVIEWS_FOR_PROMPT = 3;

interface ReviewState {
  events: number;
  lastAskAt: number; // epoch ms, 0 = jamais demandé
}

async function readState(): Promise<ReviewState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReviewState>;
      return { events: parsed.events ?? 0, lastAskAt: parsed.lastAskAt ?? 0 };
    }
  } catch {
    // état illisible → repart de zéro
  }
  return { events: 0, lastAskAt: 0 };
}

async function writeState(state: ReviewState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // stockage indisponible : tant pis, on redemandera peut-être plus tôt
  }
}

/**
 * Enregistre un moment positif et, si les conditions sont réunies, demande
 * la popup de notation native. Fire-and-forget : jamais d'exception.
 *
 * @param minEvents seuil de moments cumulés — passer `PRO_MIN_POSITIVE_EVENTS`
 *                  depuis l'espace pro.
 */
export async function recordPositiveMomentAndMaybeAskReview(
  minEvents: number = MIN_POSITIVE_EVENTS,
): Promise<void> {
  if (__DEV__) return;
  try {
    const state = await readState();
    state.events += 1;

    const cooldownOver = Date.now() - state.lastAskAt > COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    if (state.events < minEvents || !cooldownOver) {
      await writeState(state);
      return;
    }

    // Module natif absent des binaires < 1.6.0 → require paresseux.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const StoreReview = require('expo-store-review') as typeof import('expo-store-review');
    if (!(await StoreReview.isAvailableAsync())) {
      await writeState(state);
      return;
    }

    // On consomme la fenêtre AVANT l'appel : même si l'OS décide de ne pas
    // afficher la popup, on ne re-tente pas avant le prochain cooldown.
    await writeState({ events: 0, lastAskAt: Date.now() });
    setTimeout(() => {
      void StoreReview.requestReview().catch(() => {});
    }, PROMPT_DELAY_MS);
  } catch {
    // no-op : la notation ne doit jamais gêner le parcours
  }
}

/**
 * Moment positif pro : une NOUVELLE réservation est apparue dans le planning
 * depuis la dernière fois que le prestataire l'a regardé.
 *
 * Le repère est la date de création la plus récente parmi les réservations
 * affichées (`latestCreatedAtMs`), stockée en local. Elle ne peut
 * qu'AVANCER : un filtre de période plus étroit affiche moins de résas, et
 * reculer le repère ferait recompter d'anciennes réservations comme neuves.
 *
 * La toute première consultation ne compte rien : on enregistre le repère et
 * on s'arrête là, sinon tout l'historique d'un prestataire déjà installé
 * passerait pour une bonne nouvelle du jour.
 *
 * Fire-and-forget : jamais d'exception.
 */
export async function recordNewBookingSeenAndMaybeAskReview(
  latestCreatedAtMs: number,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SEEN_BOOKING_KEY);
    const { shouldCount, nextWatermark } = decideNewBookingMoment(latestCreatedAtMs, raw);

    if (nextWatermark !== null) {
      await AsyncStorage.setItem(LAST_SEEN_BOOKING_KEY, String(nextWatermark));
    }
    if (!shouldCount) return;

    await recordPositiveMomentAndMaybeAskReview(PRO_MIN_POSITIVE_EVENTS);
  } catch {
    // stockage indisponible : pas de notation, et surtout pas de crash
  }
}
