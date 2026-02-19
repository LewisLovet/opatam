import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/analytics/track-view
 * Increments today's page view count on a provider document.
 * Single atomic write — fire-and-forget from client.
 */
export async function POST(request: NextRequest) {
  try {
    const { providerId } = await request.json();

    if (!providerId || typeof providerId !== 'string') {
      return NextResponse.json({ error: 'Missing providerId' }, { status: 400 });
    }

    const db = getAdminFirestore();
    await db.collection('providers').doc(providerId).update({
      'stats.pageViews.today': FieldValue.increment(1),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[TRACK-VIEW] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
