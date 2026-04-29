import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { createArticleSchema } from '@booking-app/shared';
import { ZodError } from 'zod';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

async function verifyAdmin(uid: string) {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

// Always show "Équipe Opatam" as author — the editor doesn't expose an
// author field anymore, this is the single source of truth.
const DEFAULT_AUTHOR_NAME = 'Équipe Opatam';
const DEFAULT_AUTHOR_PHOTO = 'https://opatam.com/icon.png';

/** Strip Markdown markers and collapse whitespace to build a teaser. */
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

/**
 * GET /api/admin/articles
 * Returns ALL articles (drafts + published), newest first. Lightweight projection.
 */
export async function GET(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    if (!(await verifyAdmin(adminUid)))
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });

    const db = getAdminFirestore();
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status'); // 'draft' | 'published' | null (= all)
    const category = searchParams.get('category');

    let query: FirebaseFirestore.Query = db.collection('articles');
    if (status === 'draft' || status === 'published') {
      query = query.where('status', '==', status);
    }
    if (category) {
      query = query.where('category', '==', category);
    }
    query = query.orderBy('updatedAt', 'desc').limit(200);

    const snapshot = await query.get();

    const items = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        slug: d.slug,
        title: d.title,
        excerpt: d.excerpt,
        coverImageURL: d.coverImageURL ?? null,
        category: d.category,
        isFeatured: !!d.isFeatured,
        videoUrl: d.videoUrl ?? null,
        videoCoverURL: d.videoCoverURL ?? null,
        authorName: d.authorName,
        status: d.status,
        publishedAt: d.publishedAt ? (d.publishedAt as Timestamp).toDate().toISOString() : null,
        viewCount: d.viewCount ?? 0,
        updatedAt: d.updatedAt ? (d.updatedAt as Timestamp).toDate().toISOString() : null,
      };
    });

    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    process.stderr.write(`[ADMIN/articles GET] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/articles
 * Creates a new article. Slug must be unique.
 */
export async function POST(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    if (!(await verifyAdmin(adminUid)))
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });

    const body = await request.json();
    const validated = createArticleSchema.parse(body);

    const db = getAdminFirestore();

    // Slug uniqueness check
    const existing = await db
      .collection('articles')
      .where('slug', '==', validated.slug)
      .limit(1)
      .get();
    if (!existing.empty) {
      return NextResponse.json(
        { error: `Le slug "${validated.slug}" est déjà utilisé.` },
        { status: 409 }
      );
    }

    const now = FieldValue.serverTimestamp();
    const publishedAt =
      validated.status === 'published'
        ? Timestamp.fromDate(new Date())
        : null;

    // Auto-fill excerpt from body if empty (frontend doesn't surface the field).
    const excerpt =
      validated.excerpt && validated.excerpt.trim() !== ''
        ? validated.excerpt
        : deriveExcerpt(validated.body);

    const docRef = await db.collection('articles').add({
      ...validated,
      excerpt,
      authorName: DEFAULT_AUTHOR_NAME,
      authorPhotoURL: DEFAULT_AUTHOR_PHOTO,
      publishedAt,
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ id: docRef.id }, { status: 201 });
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
    process.stderr.write(`[ADMIN/articles POST] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
