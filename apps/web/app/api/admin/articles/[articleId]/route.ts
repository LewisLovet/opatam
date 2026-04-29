import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { updateArticleSchema } from '@booking-app/shared';
import { ZodError } from 'zod';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

async function verifyAdmin(uid: string) {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

// Locked author identity — kept in sync with the POST handler.
const DEFAULT_AUTHOR_NAME = 'Équipe Opatam';
const DEFAULT_AUTHOR_PHOTO = 'https://opatam.com/icon.png';

function deriveExcerpt(body: string, maxLen = 160): string {
  const stripped = body
    .replace(/^#+\s+/gm, '')
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>]+/g, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length <= maxLen) return stripped;
  return stripped.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
}

interface Params {
  params: Promise<{ articleId: string }>;
}

/**
 * GET /api/admin/articles/[articleId]
 * Returns the full article — drafts included.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    if (!(await verifyAdmin(adminUid)))
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });

    const { articleId } = await params;
    const db = getAdminFirestore();
    const doc = await db.collection('articles').doc(articleId).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 });
    }

    const d = doc.data()!;
    return NextResponse.json({
      id: doc.id,
      slug: d.slug,
      title: d.title,
      excerpt: d.excerpt,
      coverImageURL: d.coverImageURL ?? null,
      body: d.body,
      category: d.category,
      isFeatured: !!d.isFeatured,
      videoUrl: d.videoUrl ?? null,
      videoCoverURL: d.videoCoverURL ?? null,
      authorName: d.authorName,
      authorPhotoURL: d.authorPhotoURL ?? null,
      status: d.status,
      publishedAt: d.publishedAt ? (d.publishedAt as Timestamp).toDate().toISOString() : null,
      seoTitle: d.seoTitle ?? null,
      seoDescription: d.seoDescription ?? null,
      ogImageURL: d.ogImageURL ?? null,
      viewCount: d.viewCount ?? 0,
      createdAt: d.createdAt ? (d.createdAt as Timestamp).toDate().toISOString() : null,
      updatedAt: d.updatedAt ? (d.updatedAt as Timestamp).toDate().toISOString() : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    process.stderr.write(`[ADMIN/articles/[id] GET] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/admin/articles/[articleId]
 * Updates the article. If status flips draft→published and publishedAt is null,
 * we set publishedAt = now.
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    if (!(await verifyAdmin(adminUid)))
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });

    const { articleId } = await params;
    const body = await request.json();
    const validated = updateArticleSchema.parse(body);

    const db = getAdminFirestore();
    const ref = db.collection('articles').doc(articleId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 });
    }
    const current = snap.data()!;

    // Slug uniqueness check (only if slug changed)
    if (validated.slug && validated.slug !== current.slug) {
      const existing = await db
        .collection('articles')
        .where('slug', '==', validated.slug)
        .limit(1)
        .get();
      if (!existing.empty && existing.docs[0].id !== articleId) {
        return NextResponse.json(
          { error: `Le slug "${validated.slug}" est déjà utilisé.` },
          { status: 409 }
        );
      }
    }

    const update: Record<string, unknown> = {
      ...validated,
      updatedAt: FieldValue.serverTimestamp(),
      // Author is hardcoded — even on update, ignore whatever the client sent.
      authorName: DEFAULT_AUTHOR_NAME,
      authorPhotoURL: DEFAULT_AUTHOR_PHOTO,
    };

    // Re-derive excerpt if (a) body changed and (b) excerpt is empty.
    if (
      validated.body !== undefined &&
      (!validated.excerpt || validated.excerpt.trim() === '')
    ) {
      update.excerpt = deriveExcerpt(validated.body);
    }

    // First publish — set publishedAt
    if (
      validated.status === 'published' &&
      current.status !== 'published' &&
      !current.publishedAt
    ) {
      update.publishedAt = Timestamp.fromDate(new Date());
    }
    // Unpublish — keep publishedAt? We keep it so re-publishing later doesn't reset the date.

    await ref.update(update);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      const path = issue.path.length > 0 ? issue.path.join('.') : 'champ';
      return NextResponse.json(
        { error: `${path} — ${issue.message}`, details: error.flatten() },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    process.stderr.write(`[ADMIN/articles/[id] PUT] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/articles/[articleId]
 * Hard delete. Articles aren't soft-deletable for now (rare action, no need).
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    if (!(await verifyAdmin(adminUid)))
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });

    const { articleId } = await params;
    const db = getAdminFirestore();
    await db.collection('articles').doc(articleId).delete();

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    process.stderr.write(`[ADMIN/articles/[id] DELETE] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
