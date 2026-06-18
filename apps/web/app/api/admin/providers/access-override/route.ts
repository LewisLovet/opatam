import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

async function verifyAdmin(uid: string) {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

/**
 * POST /api/admin/providers/access-override
 *
 * Grant or revoke a manual "comp" access (free access, no payment), stored in
 * `provider.accessOverride` — OUTSIDE the Stripe-synced `subscription` object,
 * so webhooks can never overwrite it. All access gates honour it.
 *
 * Body: { providerId, action: 'grant'|'revoke', plan?: 'solo'|'team',
 *         until?: ISO string|null (null = indefinite), reason?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid || !(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const { providerId, action, plan, until, reason } = await request.json();
    if (!providerId || (action !== 'grant' && action !== 'revoke')) {
      return NextResponse.json({ error: 'providerId + action (grant|revoke) requis' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const ref = db.collection('providers').doc(providerId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Prestataire introuvable' }, { status: 404 });
    }

    if (action === 'revoke') {
      await ref.update({ accessOverride: null, updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ success: true, action: 'revoke' });
    }

    // grant
    const grantPlan = plan === 'team' ? 'team' : 'solo';
    const untilDate = until ? new Date(until) : null;
    if (until && isNaN(untilDate!.getTime())) {
      return NextResponse.json({ error: 'Date invalide' }, { status: 400 });
    }

    await ref.update({
      accessOverride: {
        active: true,
        plan: grantPlan,
        until: untilDate ? Timestamp.fromDate(untilDate) : null,
        reason: reason || null,
        grantedBy: adminUid,
        grantedAt: Timestamp.now(),
      },
      // Align the feature tier + make sure the page is visible.
      plan: grantPlan,
      isPublished: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      action: 'grant',
      plan: grantPlan,
      until: untilDate?.toISOString() ?? null,
    });
  } catch (err: any) {
    console.error('[admin/access-override] error:', err);
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}
