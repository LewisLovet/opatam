/**
 * GET /api/admin/promo-notifications — journal des envois d'emails promo
 * fidélité, pour la vue admin.
 *
 * LECTURE SEULE, et c'est volontaire : il n'existe ni bouton de renvoi ni
 * cron de reprise. Un email refusé par Resend n'est jamais réexpédié
 * automatiquement (le risque de doublon dans la boîte d'un client pèse plus
 * lourd qu'une promo manquée) — cette route sert uniquement à CONSTATER un
 * échec ou un envoi partiel.
 *
 * AUTH : Bearer Firebase ID token, VÉRIFIÉ, puis contrôle de
 * `users/{uid}.isAdmin`. C'était la première route à le faire ; toutes les
 * routes admin passent désormais par `requireAdmin` (@/lib/admin-auth), qui
 * applique exactement ce motif.
 *
 * Source : `providers/{providerId}/promoNotifications/{serviceId}`, écrit
 * par `functions/src/lib/promoEmailRunner`.
 *
 * Parcours : prestataires à fidélité activée, puis leur sous-collection.
 * Pas de `collectionGroup` — cela exigerait un index à portée groupe, dont
 * ce projet n'a aucun, alors que ces deux requêtes tiennent sur les index
 * simples automatiques.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

export type PromoNotificationStatus = 'pending' | 'sent' | 'partial' | 'failed';

export interface PromoNotificationRow {
  id: string;
  providerId: string;
  businessName: string;
  serviceId: string;
  serviceName: string;
  /** Remise figée à l'envoi : pourcentage, ou 0 si la promo était en euros. */
  percent: number;
  /** Montant en centimes, null pour une promo en pourcentage. */
  amount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  status: PromoNotificationStatus;
  recipientsCount: number;
  sentCount: number;
  failedCount: number;
  attempts: number;
  claimedAt: string | null;
  sentAt: string | null;
  lastError: string | null;
}

/**
 * Retourne l'UID si le porteur du token est bien un admin, sinon le code
 * HTTP à renvoyer. Le token est vérifié cryptographiquement par Firebase :
 * il ne peut pas être fabriqué à partir d'un simple identifiant.
 */
async function requireAdmin(req: NextRequest): Promise<{ uid: string } | { status: 401 | 403 }> {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return { status: 401 };

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(header.slice('Bearer '.length));
    uid = decoded.uid;
  } catch {
    return { status: 401 };
  }

  const userDoc = await getAdminFirestore().collection('users').doc(uid).get();
  if (!userDoc.exists || userDoc.data()?.isAdmin !== true) return { status: 403 };
  return { uid };
}

const toIso = (v: unknown): string | null => {
  const d = (v as { toDate?: () => Date } | undefined)?.toDate?.();
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ('status' in auth) {
      return NextResponse.json(
        { error: auth.status === 401 ? 'Non authentifié' : 'Accès non autorisé' },
        { status: auth.status },
      );
    }

    const db = getAdminFirestore();
    const providersSnap = await db
      .collection('providers')
      .where('settings.loyalty.enabled', '==', true)
      .get();

    const perProvider = await Promise.all(
      providersSnap.docs.map(async (providerDoc) => {
        const ledgers = await providerDoc.ref.collection('promoNotifications').get();
        const businessName = (providerDoc.data().businessName as string) ?? '—';
        return ledgers.docs.map((d): PromoNotificationRow => {
          const l = d.data();
          const recipientsCount = (l.recipientsCount as number | undefined) ?? 0;
          // `sentCount` n'existe pas sur les registres écrits avant cette
          // vue : on retombe sur la longueur de `sentTo`.
          const sentCount =
            (l.sentCount as number | undefined) ?? ((l.sentTo as string[] | undefined)?.length ?? 0);
          return {
            id: `${providerDoc.id}_${d.id}`,
            providerId: providerDoc.id,
            businessName,
            serviceId: (l.serviceId as string) ?? d.id,
            serviceName: (l.serviceName as string) ?? '—',
            percent: (l.percent as number | undefined) ?? 0,
            amount: (l.amount as number | null | undefined) ?? null,
            startsAt: (l.startsAt as string | null) ?? null,
            endsAt: (l.endsAt as string | null) ?? null,
            status: ((l.status as PromoNotificationStatus | undefined) ?? 'pending'),
            recipientsCount,
            sentCount,
            failedCount:
              (l.failedCount as number | undefined) ?? Math.max(0, recipientsCount - sentCount),
            attempts: (l.attempts as number | undefined) ?? 0,
            claimedAt: toIso(l.claimedAt),
            sentAt: toIso(l.sentAt),
            lastError: (l.lastError as string | null) ?? null,
          };
        });
      }),
    );

    // Les incidents d'abord, puis du plus récent au plus ancien : l'admin
    // ouvre cette page pour voir ce qui a raté.
    const severity: Record<PromoNotificationStatus, number> = {
      failed: 0,
      partial: 1,
      pending: 2,
      sent: 3,
    };
    const rows = perProvider.flat().sort((a, b) => {
      const s = severity[a.status] - severity[b.status];
      if (s !== 0) return s;
      return (b.sentAt ?? b.claimedAt ?? '').localeCompare(a.sentAt ?? a.claimedAt ?? '');
    });

    return NextResponse.json({ rows });
  } catch (e) {
    console.error('[admin/promo-notifications] error:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
