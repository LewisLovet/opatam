import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
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
const BROADCAST_AUDIENCES = ['pros', 'clients', 'all'];

/** Verifies the admin's own personal code (bcrypt adminCodeHash). */
async function verifyAdminActionCode(
  uid: string,
  code: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (typeof code !== 'string' || !code) return { ok: false, error: 'Code requis' };
  const db = getAdminFirestore();
  const snap = await db.collection('users').doc(uid).get();
  const data = snap.data();
  if (!snap.exists || data?.isAdmin !== true) return { ok: false, error: 'Non autorisé' };
  if (!data?.adminCodeHash) {
    return { ok: false, error: 'Aucun code admin défini (configure-le via « Modifier le code »)' };
  }
  const ok = await bcrypt.compare(code, data.adminCodeHash);
  return ok ? { ok: true } : { ok: false, error: 'Code incorrect' };
}

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

    // A future schedule keeps the notif unpublished (the cron publishes it).
    const scheduledAt = (() => {
      if (typeof body.scheduledAt !== 'string' || !body.scheduledAt.trim()) return null;
      const d = new Date(body.scheduledAt);
      return !isNaN(d.getTime()) && d.getTime() > Date.now() ? d : null;
    })();
    const willPublish = !!body.isPublished && !scheduledAt;

    // Broadcasting to a wide audience requires the confirmation code, whether
    // it publishes now or is scheduled to publish later.
    if ((willPublish || !!scheduledAt) && BROADCAST_AUDIENCES.includes(audience)) {
      const check = await verifyAdminActionCode(adminUid, body.actionCode);
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 403 });
      }
    }

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
      ctaThumbUrl: str(body.ctaArticleSlug) ? str(body.ctaThumbUrl) : null,
      ctaIsVideo: str(body.ctaArticleSlug) ? !!body.ctaIsVideo : false,
      isPublished: willPublish,
      sendPush: !!body.sendPush,
      scheduledAt,
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
    // Scheduled for later — hidden now, and reset the push guard so the
    // cron's future publish dispatches the push.
    if (scheduledAt) {
      update.publishedAt = null;
      update.pushedAt = null;
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
