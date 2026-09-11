import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/analytics/track-view  { providerId, src? }
 * Increments today's page view count on a provider document.
 * Single atomic write — fire-and-forget from client (web AND mobile : le
 * SDK client n'a pas le droit d'écrire `stats`, seule cette route le peut).
 *
 * `src: 'story'` = la visite vient d'un lien ou QR intégré à une story
 * (`?src=story`) : un compteur séparé `storyToday` est aussi incrémenté.
 * La déduplication par session est faite côté client.
 */
export async function POST(request: NextRequest) {
  try {
    const { providerId, src } = await request.json();

    if (!providerId || typeof providerId !== 'string') {
      return NextResponse.json({ error: 'Missing providerId' }, { status: 400 });
    }

    const db = getAdminFirestore();
    await db.collection('providers').doc(providerId).update({
      'stats.pageViews.today': FieldValue.increment(1),
      ...(src === 'story' ? { 'stats.pageViews.storyToday': FieldValue.increment(1) } : {}),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[TRACK-VIEW] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
