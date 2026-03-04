import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { userId, code } = await request.json();

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    const db = getAdminFirestore();

    // 1. Verify user exists and is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || !userDoc.data()?.isAdmin) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const userData = userDoc.data()!;

    // 2. Check if admin code hash exists on user doc
    if (!userData.adminCodeHash) {
      return NextResponse.json({ error: 'NO_CODE_SET' }, { status: 404 });
    }

    // 3. Code is required for verification
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code requis' }, { status: 400 });
    }

    // 4. Compare code against user's personal hash
    const isValid = await bcrypt.compare(code, userData.adminCodeHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Code incorrect' }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/verify-code] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
