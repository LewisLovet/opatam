import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Liens d'invitation de l'équipe commerciale — valables 7 JOURS.
 *
 * Firebase ne permet pas d'allonger la durée de vie de ses liens de
 * définition de mot de passe (de l'ordre de l'heure) : un commercial qui
 * ouvre son e-mail le lendemain tombe sur « lien expiré ». Le lien envoyé
 * est donc le NÔTRE — un jeton signé (HMAC-SHA256, même secret que les
 * liens d'attribution) qui pointe vers /api/admin/staff/invite. Au clic, le
 * serveur vérifie le jeton puis fabrique le lien Firebase À CET INSTANT et
 * y redirige : la courte validité Firebase ne court qu'à partir du clic.
 *
 * SERVEUR UNIQUEMENT : le secret ne doit jamais atteindre un bundle client.
 */

const TOKEN_VERSION = 'si1';
export const STAFF_INVITE_TTL_DAYS = 7;

interface StaffInvitePayload {
  uid: string;
  /** Émission, epoch secondes. */
  issuedAt: number;
}

function secret(): string {
  const s = process.env.SALES_LINK_SECRET;
  if (!s) throw new Error('SALES_LINK_SECRET manquant');
  return s;
}

const b64u = (buf: Buffer) => buf.toString('base64url');

export function signStaffInvite(uid: string): string {
  const payload: StaffInvitePayload = { uid, issuedAt: Math.floor(Date.now() / 1000) };
  const body = b64u(Buffer.from(JSON.stringify(payload), 'utf8'));
  const mac = createHmac('sha256', secret()).update(`${TOKEN_VERSION}.${body}`).digest();
  return `${TOKEN_VERSION}.${body}.${b64u(mac)}`;
}

export type StaffInviteVerification =
  | { ok: true; uid: string }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'expired' };

export function verifyStaffInvite(token: string): StaffInviteVerification {
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

  let payload: StaffInvitePayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof payload.uid !== 'string' || !payload.uid || typeof payload.issuedAt !== 'number') {
    return { ok: false, reason: 'malformed' };
  }
  const age = Date.now() / 1000 - payload.issuedAt;
  if (age > STAFF_INVITE_TTL_DAYS * 86_400 || age < -300) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, uid: payload.uid };
}

/** L'URL à mettre dans l'e-mail (et à copier côté admin). */
export function buildStaffInviteUrl(uid: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com';
  return `${baseUrl}/api/admin/staff/invite?t=${encodeURIComponent(signStaffInvite(uid))}`;
}
