import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Liens commerciaux signés — l'attribution commence ici.
 *
 * Un lien `opatam.com/register?s=<jeton>` porte le commercial, la campagne et
 * le secteur. SIGNÉ (HMAC-SHA256, secret serveur) : un jeton forgé ou altéré
 * est rejeté — sans signature, n'importe qui pourrait s'attribuer des
 * inscriptions en fabriquant des liens, et la rémunération des commerciaux
 * reposerait sur du sable.
 *
 * Le jeton est autoportant (pas de lecture en base pour le vérifier) et
 * borné dans le temps : un lien traîne dans une story Instagram ou un vieux
 * message des mois — 180 jours couvrent le cycle de vente réel sans créer
 * des liens éternels.
 *
 * SERVEUR UNIQUEMENT : le secret ne doit jamais atteindre un bundle client.
 */

const TOKEN_VERSION = 'v1';
export const SALES_LINK_TTL_DAYS = 180;

export interface SalesLinkPayload {
  /** uid du commercial (staffMembers). */
  staffUid: string;
  /** Campagne libre — « salon-2026 », « instagram-mars »… */
  campaign: string | null;
  /** Secteur ciblé, pour préconfigurer la démo un jour. */
  sector: string | null;
  /** Émission, epoch secondes — borne le jeton dans le temps. */
  issuedAt: number;
}

function secret(): string {
  const s = process.env.SALES_LINK_SECRET;
  if (!s) throw new Error('SALES_LINK_SECRET manquant');
  return s;
}

const b64u = (buf: Buffer) => buf.toString('base64url');

export function signSalesLink(payload: Omit<SalesLinkPayload, 'issuedAt'>): string {
  const full: SalesLinkPayload = { ...payload, issuedAt: Math.floor(Date.now() / 1000) };
  const body = b64u(Buffer.from(JSON.stringify(full), 'utf8'));
  const mac = createHmac('sha256', secret()).update(`${TOKEN_VERSION}.${body}`).digest();
  return `${TOKEN_VERSION}.${body}.${b64u(mac)}`;
}

export type SalesLinkVerification =
  | { ok: true; payload: SalesLinkPayload }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'expired' };

export function verifySalesLink(token: string): SalesLinkVerification {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return { ok: false, reason: 'malformed' };
  const [, body, mac] = parts;

  let expected: Buffer;
  let given: Buffer;
  try {
    expected = createHmac('sha256', secret()).update(`${TOKEN_VERSION}.${body}`).digest();
    given = Buffer.from(mac, 'base64url');
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'bad-signature' };
  }

  let payload: SalesLinkPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!payload.staffUid || typeof payload.issuedAt !== 'number') {
    return { ok: false, reason: 'malformed' };
  }
  const age = Date.now() / 1000 - payload.issuedAt;
  if (age > SALES_LINK_TTL_DAYS * 86_400 || age < -300) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, payload };
}
