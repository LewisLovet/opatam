import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Jetons des liens d'invitation des MEMBRES d'un salon — valables 7 jours.
 *
 * Même mécanique que les invitations de l'équipe commerciale
 * (`staff-invite.ts`) : un HMAC-SHA256 avec le secret des liens signés. Le
 * préfixe de version entre dans la signature : un jeton commercial (`si1`)
 * ne peut pas servir d'invitation membre (`mi1`), ni l'inverse.
 *
 * Le jeton ne porte QUE l'identifiant de l'invitation et sa date : le
 * document `memberInvitations/{id}` dit si elle vaut encore (renvoyée,
 * retirée, déjà acceptée). Rien de personnel ne circule dans l'URL.
 *
 * SERVEUR UNIQUEMENT : le secret ne doit jamais atteindre un bundle client.
 */

const TOKEN_VERSION = 'mi1';
export const MEMBER_INVITE_TTL_DAYS = 7;

interface MemberInvitePayload {
  /** Identifiant du document `memberInvitations/{id}`. */
  i: string;
  /** Émission, epoch secondes. */
  t: number;
}

function secret(): string {
  const s = process.env.SALES_LINK_SECRET;
  if (!s) throw new Error('SALES_LINK_SECRET manquant');
  return s;
}

const b64u = (buf: Buffer) => buf.toString('base64url');

export function signMemberInvite(invitationId: string, maintenant = Date.now()): string {
  const payload: MemberInvitePayload = { i: invitationId, t: Math.floor(maintenant / 1000) };
  const body = b64u(Buffer.from(JSON.stringify(payload), 'utf8'));
  const mac = createHmac('sha256', secret()).update(`${TOKEN_VERSION}.${body}`).digest();
  return `${TOKEN_VERSION}.${body}.${b64u(mac)}`;
}

export type MemberInviteVerification =
  | { ok: true; invitationId: string }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'expired' };

export function verifyMemberInvite(token: unknown, maintenant = Date.now()): MemberInviteVerification {
  if (typeof token !== 'string' || token.length > 600) return { ok: false, reason: 'malformed' };
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

  let payload: MemberInvitePayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  // L'identifiant devient un chemin de document : jamais de « / ».
  if (typeof payload.i !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(payload.i) || typeof payload.t !== 'number') {
    return { ok: false, reason: 'malformed' };
  }
  const age = maintenant / 1000 - payload.t;
  if (age > MEMBER_INVITE_TTL_DAYS * 86_400 || age < -300) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, invitationId: payload.i };
}
