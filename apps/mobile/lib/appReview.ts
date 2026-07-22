/**
 * In-app store review prompt (App Store / Play Store natif).
 *
 * Appelé aux « moments positifs » (résa confirmée, avis 4-5 étoiles déposé).
 * Le prompt n'est demandé que si :
 *   - au moins MIN_POSITIVE_EVENTS moments positifs cumulés,
 *   - pas de demande dans les COOLDOWN_DAYS derniers jours.
 * L'OS garde de toute façon le dernier mot (iOS plafonne à ~3 affichages/an
 * et ne dit jamais si la popup a réellement été montrée).
 *
 * IMPORTANT (OTA) : expo-store-review est un module NATIF présent seulement
 * à partir du build 1.6.0. Ce fichier part aussi en OTA vers des binaires
 * plus anciens — d'où le require() paresseux sous try/catch : sur un vieux
 * binaire l'appel est simplement un no-op, jamais un crash.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@opatam/store_review';
const MIN_POSITIVE_EVENTS = 2;
const COOLDOWN_DAYS = 120;
const PROMPT_DELAY_MS = 1500; // laisse le toast de succès / la navigation se poser

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
 */
export async function recordPositiveMomentAndMaybeAskReview(): Promise<void> {
  if (__DEV__) return;
  try {
    const state = await readState();
    state.events += 1;

    const cooldownOver = Date.now() - state.lastAskAt > COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    if (state.events < MIN_POSITIVE_EVENTS || !cooldownOver) {
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
