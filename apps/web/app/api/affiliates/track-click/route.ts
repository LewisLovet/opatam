import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/affiliates/track-click
 * Track a click on an affiliate's referral link
 * Body: { code }
 */
export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    if (!code) return NextResponse.json({ ok: true });

    const db = getAdminFirestore();
    const snapshot = await db
      .collection('affiliates')
      .where('code', '==', code.toUpperCase().trim())
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      await db.collection('affiliates').doc(snapshot.docs[0].id).update({
        'stats.linkClicks': FieldValue.increment(1),
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Fail silently
  }
}
