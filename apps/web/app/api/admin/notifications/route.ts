import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * In-app notifications (announcements / what's new) authored from the
 * admin back-office and shown in the mobile notification center.
 * Stored in the top-level `appNotifications` collection.
 *
 * GET  — list all notifications (admin UI) + published tutorials for
 *        the CTA picker.
 * POST — create a notification (admin-gated via x-admin-uid).
 */

async function verifyAdmin(uid: string): Promise<boolean> {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

/** Broadcasting a published notification to a wide audience requires the
 *  confirmation code. Targeted (specific / admins) sends do not. */
const BROADCAST_AUDIENCES = ['pros', 'clients', 'all'];
function requiresActionCode(audience: string, isPublished: boolean): boolean {
  return isPublished && BROADCAST_AUDIENCES.includes(audience);
}
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

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

const ALLOWED_AUDIENCES = ['pros', 'clients', 'all', 'admins', 'specific'];
const ALLOWED_TYPES = ['announcement', 'feature', 'tutorial'];

/** Derive a YouTube thumbnail from a watch / share / embed URL. */
function ytThumb(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

function buildDoc(body: any) {
  const audience = ALLOWED_AUDIENCES.includes(body.audience) ? body.audience : 'pros';
  const type = ALLOWED_TYPES.includes(body.type) ? body.type : 'announcement';
  return {
    title: str(body.title) ?? '',
    body: str(body.body) ?? '',
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
    isPublished: !!body.isPublished,
    sendPush: !!body.sendPush,
  };
}

// GET — list notifications + tutorials for the CTA dropdown.
export async function GET() {
  try {
    const db = getAdminFirestore();
    const [notifsSnap, tutosSnap] = await Promise.all([
      db.collection('appNotifications').orderBy('createdAt', 'desc').get(),
      db
        .collection('articles')
        .where('status', '==', 'published')
        .where('category', '==', 'tutoriels')
        .get(),
    ]);

    const notifications = notifsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const tutorials = tutosSnap.docs
      .map((d) => {
        const a = d.data();
        const thumbUrl =
          (a.videoCoverURL as string | null) ||
          ytThumb(a.videoUrl as string | null) ||
          (a.coverImageURL as string | null) ||
          null;
        return {
          slug: a.slug as string,
          title: a.title as string,
          thumbUrl,
          isVideo: !!a.videoUrl,
        };
      })
      .filter((t) => t.slug);

    return NextResponse.json({ notifications, tutorials });
  } catch (err: any) {
    console.error('[admin/notifications] GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — create a notification.
export async function POST(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid || !(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const body = await request.json();
    const data = buildDoc(body);
    if (!data.title || !data.body) {
      return NextResponse.json({ error: 'Titre et message requis' }, { status: 400 });
    }

    if (requiresActionCode(data.audience, data.isPublished)) {
      const check = await verifyAdminActionCode(adminUid, body.actionCode);
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 403 });
      }
    }

    const now = new Date();
    const db = getAdminFirestore();
    const ref = await db.collection('appNotifications').add({
      ...data,
      publishedAt: data.isPublished ? now : null,
      pushedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err: any) {
    console.error('[admin/notifications] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
