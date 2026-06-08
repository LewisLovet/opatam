import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

async function verifyAdmin(uid: string): Promise<boolean> {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

const ALLOWED_AUDIENCES = ['pros', 'clients', 'all', 'admins', 'specific'];
const ALLOWED_TYPES = ['announcement', 'feature', 'tutorial'];

// PUT — update a notification (and flip publish state).
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid || !(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const db = getAdminFirestore();
    const ref = db.collection('appNotifications').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    }
    const current = snap.data() || {};

    const audience = ALLOWED_AUDIENCES.includes(body.audience) ? body.audience : 'pros';
    const type = ALLOWED_TYPES.includes(body.type) ? body.type : 'announcement';
    const title = str(body.title) ?? '';
    const text = str(body.body) ?? '';
    if (!title || !text) {
      return NextResponse.json({ error: 'Titre et message requis' }, { status: 400 });
    }

    const willPublish = !!body.isPublished;
    const update: Record<string, unknown> = {
      title,
      body: text,
      modalBody: str(body.modalBody),
      type,
      audience,
      targetUserId: audience === 'specific' ? str(body.targetUserId) : null,
      targetLabel: audience === 'specific' ? str(body.targetLabel) : null,
      iconName: str(body.iconName),
      imageUrl: str(body.imageUrl),
      ctaLabel: str(body.ctaLabel),
      ctaArticleSlug: str(body.ctaArticleSlug),
      isPublished: willPublish,
      sendPush: !!body.sendPush,
      updatedAt: new Date(),
    };

    // First publish — stamp publishedAt and reset the push guard so the
    // Cloud Function can dispatch (if sendPush is on).
    if (willPublish && !current.isPublished) {
      update.publishedAt = new Date();
      update.pushedAt = null;
    }
    // Unpublish — keep history but hide from the app.
    if (!willPublish && current.isPublished) {
      update.publishedAt = null;
    }

    await ref.set(update, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[admin/notifications/:id] PUT error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — remove a notification.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid || !(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }
    const { id } = await params;
    await getAdminFirestore().collection('appNotifications').doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[admin/notifications/:id] DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
