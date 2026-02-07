import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function GET() {
  console.log('[PROVIDERS-LIST] ========== START ==========');
  try {
    const db = getAdminFirestore();
    const snapshot = await db.collection('providers')
      .orderBy('businessName', 'asc')
      .limit(50)
      .get();

    const providers = snapshot.docs.map(doc => ({
      id: doc.id,
      businessName: doc.data().businessName || 'Sans nom',
      plan: doc.data().plan || 'trial',
    }));

    console.log(`[PROVIDERS-LIST] Found ${providers.length} provider(s)`);
    console.log('[PROVIDERS-LIST] ========== END ==========');
    return NextResponse.json({ providers });
  } catch (error) {
    console.error('[PROVIDERS-LIST] EXCEPTION:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
