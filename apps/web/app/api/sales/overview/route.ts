import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { computeEntitlements, computeActivation } from '@booking-app/shared';

/**
 * Vue d'ensemble du tableau de bord commercial.
 *
 * Dynamique DÈS LE PREMIER JOUR, avant tout prospect saisi : les essais qui
 * expirent, les comptes récents à activer et le pipeline viennent des
 * données produit — c'est l'avantage décisif relevé par l'audit : le
 * commercial voit ce que fait réellement le compte, pas un CRM à côté.
 *
 * Toutes les décisions sont les fonctions officielles partagées :
 * computeEntitlements (payant/essai/comp) et computeActivation (la
 * définition de l'activation). Rien n'est recalculé à la main ici.
 */

export const dynamic = 'force-dynamic';

interface EssaiRow {
  providerId: string;
  businessName: string;
  joursRestants: number;
  activation: ReturnType<typeof computeActivation>;
}

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  try {
    const db = getAdminFirestore();
    const now = Date.now();

    const [trialingSnap, recentSnap, leadsSnap] = await Promise.all([
      db.collection('providers').where('subscription.status', '==', 'trialing').get(),
      db.collection('providers').orderBy('createdAt', 'desc').limit(20).get(),
      db.collection('salesLeads').get(),
    ]);

    /** Activation réelle d'un compte — trois petites lectures ciblées. */
    async function activationDe(providerId: string, isPublished: boolean) {
      const [servicesCount, availSnap, bookingsSnap] = await Promise.all([
        db.collection('providers').doc(providerId).collection('services')
          .where('isActive', '==', true).count().get(),
        db.collection('providers').doc(providerId).collection('availabilities').limit(1).get(),
        db.collection('bookings').where('providerId', '==', providerId).limit(5).get(),
      ]);
      const realBookings = bookingsSnap.docs.filter((d) => {
        const b = d.data();
        return !b.demoSeed && b.status !== 'cancelled';
      }).length;
      // Les COMPTES exacts accompagnent la décision : « 1 prestation sur 3 »
      // parle, une jauge muette non — retour d'usage du premier écran.
      const activeServicesCount = servicesCount.data().count;
      return {
        ...computeActivation({
          isPublished,
          activeServicesCount,
          hasAvailability: !availSnap.empty,
          realBookingsCount: realBookings,
        }),
        activeServicesCount,
      };
    }

    // ── Essais qui expirent (hors comptes de test, comps et cartes réelles) ──
    const essaisAScruter = trialingSnap.docs.filter((doc) => {
      const p = doc.data();
      if (p.isTest) return false;
      const e = computeEntitlements(p as never);
      // Un comp n'expire pas ; une carte enregistrée convertira toute seule.
      if (e.compActive || e.paidUnderneath) return false;
      const until = p.subscription?.validUntil?.toDate?.()?.getTime();
      if (!until) return false;
      const jours = Math.ceil((until - now) / 86_400_000);
      return jours >= 0 && jours <= 7;
    });

    const essaisQuiExpirent: EssaiRow[] = await Promise.all(
      essaisAScruter.slice(0, 12).map(async (doc) => {
        const p = doc.data();
        const until = p.subscription.validUntil.toDate().getTime();
        return {
          providerId: doc.id,
          businessName: p.businessName ?? '(sans nom)',
          joursRestants: Math.ceil((until - now) / 86_400_000),
          activation: await activationDe(doc.id, p.isPublished === true),
        };
      }),
    );
    essaisQuiExpirent.sort((a, b) => a.joursRestants - b.joursRestants);

    // ── Comptes récents (14 j) pas encore activés ─────────────────────────
    const recents = recentSnap.docs.filter((doc) => {
      const p = doc.data();
      const created = p.createdAt?.toDate?.()?.getTime() ?? 0;
      return !p.isTest && now - created <= 14 * 86_400_000;
    });
    const aActiver = (
      await Promise.all(
        recents.map(async (doc) => {
          const p = doc.data();
          return {
            providerId: doc.id,
            businessName: p.businessName ?? '(sans nom)',
            joursDepuisInscription: Math.floor((now - (p.createdAt?.toDate?.()?.getTime() ?? now)) / 86_400_000),
            activation: await activationDe(doc.id, p.isPublished === true),
          };
        }),
      )
    ).filter((r) => !r.activation.activated);

    // ── Pipeline (vide tant qu'aucun prospect n'est saisi — et c'est vrai) ──
    const parEtape: Record<string, number> = {};
    leadsSnap.docs.forEach((d) => {
      const stage = d.data().stage ?? 'prospect';
      parEtape[stage] = (parEtape[stage] ?? 0) + 1;
    });

    return NextResponse.json({
      role: auth.identity.role,
      essaisQuiExpirent,
      aActiver,
      pipeline: { total: leadsSnap.size, parEtape },
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[sales/overview] error:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
