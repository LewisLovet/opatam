import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { userId, currentCode, newCode } = await request.json();

    if (!userId || !newCode || typeof userId !== 'string' || typeof newCode !== 'string') {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    if (newCode.length < 4) {
      return NextResponse.json({ error: 'Le code doit faire au moins 4 caractères' }, { status: 400 });
    }

    const db = getAdminFirestore();

    // 1. Verify user exists and is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || !userDoc.data()?.isAdmin) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const userData = userDoc.data()!;

    // 2. If user already has a code, verify current code first
    if (userData.adminCodeHash) {
      if (!currentCode || typeof currentCode !== 'string') {
        return NextResponse.json({ error: 'Code actuel requis' }, { status: 400 });
      }

      const isValid = await bcrypt.compare(currentCode, userData.adminCodeHash);
      if (!isValid) {
        return NextResponse.json({ error: 'Code actuel incorrect' }, { status: 401 });
      }
    }

    // 3. Hash and save the new code
    const newHash = await bcrypt.hash(newCode, 10);
    await db.collection('users').doc(userId).update({ adminCodeHash: newHash });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/change-code] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
