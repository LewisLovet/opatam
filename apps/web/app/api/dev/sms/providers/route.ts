import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * GET /api/dev/sms/providers
 *
 * Dev-only: returns a slim list of providers with the phone of their owner
 * user, so the SMS test tool can prefill the form when picking a provider.
 *
 * Returns up to 200 published providers, sorted by businessName.
 */
export interface SmsTestProvider {
  id: string;
  businessName: string;
  slug: string;
  phone: string | null;
  city: string | null;
}

export async function GET() {
  try {
    const db = getAdminFirestore();

    // No orderBy here so we don't need a composite index. We sort
    // alphabetically in JS below.
    const snapshot = await db
      .collection('providers')
      .where('isPublished', '==', true)
      .limit(200)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ providers: [] satisfies SmsTestProvider[] });
    }

    // Batch fetch the owner users to grab their phone numbers
    const userIds = Array.from(
      new Set(
        snapshot.docs
          .map((d) => d.data().userId as string | undefined)
          .filter((u): u is string => Boolean(u))
      )
    );

    const userRefs = userIds.map((id) => db.collection('users').doc(id));
    const userDocs = userRefs.length > 0 ? await db.getAll(...userRefs) : [];
    const phoneByUserId = new Map<string, string | null>();
    for (const doc of userDocs) {
      if (doc.exists) {
        phoneByUserId.set(doc.id, (doc.data()?.phone as string | null) ?? null);
      }
    }

    const providers: SmsTestProvider[] = snapshot.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          businessName: (data.businessName as string) ?? '(sans nom)',
          slug: (data.slug as string) ?? '',
          phone: phoneByUserId.get(data.userId as string) ?? null,
          city: (data.cities as string[] | undefined)?.[0] ?? null,
        };
      })
      .sort((a, b) => a.businessName.localeCompare(b.businessName, 'fr'));

    return NextResponse.json({ providers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    // Log via process.stderr to dodge any Next.js dev console.error wrapping
    process.stderr.write(`[DEV/SMS/providers] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
