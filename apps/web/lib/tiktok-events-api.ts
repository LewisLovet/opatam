/**
 * API d'événements TikTok — envoi serveur à serveur.
 *
 * Pourquoi : le pixel navigateur est bloqué par les bloqueurs de pub sur
 * une part des visites et dégradé sur iPhone. Le serveur envoie les
 * conversions dont il est certain (compte créé, abonnement, acompte payé)
 * directement à TikTok ; aucun bloqueur ne s'interpose.
 *
 * Déduplication : le MÊME `event_id` que le pixel (`CompleteRegistration:<uid>`,
 * `Purchase:<bookingId>`, `Subscribe:<subscriptionId>`) — TikTok ne compte
 * qu'une fois quand les deux arrivent.
 *
 * Même contrat que lib/meta-capi.ts : jamais d'exception, jamais bloquant,
 * rien sans TIKTOK_EVENTS_API_TOKEN. E-mail, téléphone et identifiant sont
 * hachés en SHA-256 ici. Référence : POST /open_api/v1.3/event/track/.
 */

import { createHash } from 'crypto';

const PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID ?? '';
const ACCESS_TOKEN = process.env.TIKTOK_EVENTS_API_TOKEN ?? '';
/** Code de test de la page « Événements de test » : les envois marqués n'entrent pas dans les données réelles. */
const TEST_EVENT_CODE = process.env.TIKTOK_TEST_EVENT_CODE ?? '';

export type TikTokServerEvent =
  | 'CompleteRegistration'
  | 'Subscribe'
  | 'Purchase'
  | 'Lead';

export interface TikTokServerUser {
  email?: string | null;
  /** Tel quel ; normalisé en E.164 avant hachage. */
  phone?: string | null;
  externalId?: string | null;
  /** Identifiant de clic TikTok lu sur le lien de la pub (`ttclid`). */
  ttclid?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface TikTokServerEventInput {
  event: TikTokServerEvent;
  eventId: string;
  /** Secondes Unix ; maintenant par défaut. */
  eventTime?: number;
  url?: string | null;
  user: TikTokServerUser;
  properties?: {
    contents?: { content_id: string; content_type: 'product' | 'product_group'; content_name?: string }[];
    value?: number;
    currency?: string;
  };
}

function sha256(v: string): string {
  return createHash('sha256').update(v).digest('hex');
}

function emailHache(v: string | null | undefined): string | undefined {
  const t = (v ?? '').trim().toLowerCase();
  return t ? sha256(t) : undefined;
}

/** « 06 12 34 56 78 » → « +33612345678 » avant hachage. */
function telephoneHache(v: string | null | undefined): string | undefined {
  const chiffres = (v ?? '').replace(/\D/g, '');
  if (chiffres.length < 8) return undefined;
  const e164 =
    chiffres.length === 10 && chiffres.startsWith('0') ? `+33${chiffres.slice(1)}` : `+${chiffres}`;
  return sha256(e164);
}

export async function sendTikTokEvent(
  input: TikTokServerEventInput,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!PIXEL_ID || !ACCESS_TOKEN) return { ok: false, reason: 'not-configured' };

  const user: Record<string, string> = {};
  const em = emailHache(input.user.email);
  const ph = telephoneHache(input.user.phone);
  const ext = input.user.externalId ? sha256(input.user.externalId.trim()) : undefined;
  if (em) user.email = em;
  if (ph) user.phone = ph;
  if (ext) user.external_id = ext;
  if (input.user.ttclid) user.ttclid = input.user.ttclid;
  if (input.user.ip) user.ip = input.user.ip;
  if (input.user.userAgent) user.user_agent = input.user.userAgent;

  const payload: Record<string, unknown> = {
    event_source: 'web',
    event_source_id: PIXEL_ID,
    ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
    data: [
      {
        event: input.event,
        event_id: input.eventId,
        event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
        user,
        ...(input.properties ? { properties: input.properties } : {}),
        ...(input.url ? { page: { url: input.url } } : {}),
      },
    ],
  };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Access-Token': ACCESS_TOKEN },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));
    const corps = (await res.json().catch(() => null)) as { code?: number; message?: string } | null;
    // TikTok répond 200 même en erreur : c'est `code` qui fait foi (0 = ok).
    if (!res.ok || (corps && corps.code !== 0)) {
      console.warn(`[TIKTOK-API] ${input.event} refusé : HTTP ${res.status} code=${corps?.code} ${corps?.message ?? ''}`);
      return { ok: false, reason: `code-${corps?.code ?? res.status}` };
    }
    console.log(`[TIKTOK-API] ${input.event} envoyé (event_id=${input.eventId})`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[TIKTOK-API] ${input.event} a échoué : ${msg}`);
    return { ok: false, reason: `error:${msg}` };
  }
}
