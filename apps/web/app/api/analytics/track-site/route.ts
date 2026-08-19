import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { isSiteMetricKey, metricDay, metricDocId } from '@/lib/siteMetrics';

/**
 * POST /api/analytics/track-site
 *
 * Incrémente un compteur journalier du site. Une seule écriture atomique,
 * appelée sans attendre la réponse depuis le client.
 *
 * La clé est validée contre une liste FERMÉE : ce point d'entrée est public,
 * et sans elle n'importe qui pourrait créer autant de documents qu'il veut.
 *
 * Aucune donnée de visiteur n'est enregistrée — ni adresse, ni identifiant,
 * ni empreinte. Le document ne contient qu'un jour, une clé et un nombre.
 */
export async function POST(request: NextRequest) {
  try {
    const { key } = await request.json();

    if (!isSiteMetricKey(key)) {
      return NextResponse.json({ error: 'Unknown metric key' }, { status: 400 });
    }

    const day = metricDay();
    const db = getAdminFirestore();
    await db
      .collection('siteMetricsDaily')
      .doc(metricDocId(key, day))
      .set(
        { day, key, count: FieldValue.increment(1) },
        { merge: true }
      );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[TRACK-SITE] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
