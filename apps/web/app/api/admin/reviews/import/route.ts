import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { importReviewsSchema } from '@booking-app/shared';
import { resend, emailConfig, appConfig, getEmailWrapperHtml, isValidEmail } from '@/lib/resend';

async function verifyAdmin(uid: string) {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

function clampRating(n: number): number {
  return Math.min(5, Math.max(1, Math.round(n)));
}

/**
 * POST /api/admin/reviews/import
 *
 * Admin-only endpoint to bulk-import external reviews (e.g. from a
 * competitor's export) for a given provider. Each created review:
 *   - is anonymous (no client identity is ever imported),
 *   - has `isPublic: true` + an integer rating 1..5, so the
 *     `onReviewRatingUpdate` Cloud Function auto-counts it and the
 *     integer distribution stays intact,
 *   - carries `imported: true` + internal `source` (never shown
 *     publicly — the public page only renders a neutral badge).
 *
 * We DO NOT touch provider.rating here — the rating trigger is the
 * single source of truth and recomputes it on every review write.
 *
 * Dedup: when an item has a `sourceRef`, we skip it if a review with
 * the same (providerId, source, sourceRef) already exists.
 */
export async function POST(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (!(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = importReviewsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { providerId, source, reviews } = parsed.data;
    const db = getAdminFirestore();

    // Validate the provider exists.
    const providerDoc = await db.collection('providers').doc(providerId).get();
    if (!providerDoc.exists) {
      return NextResponse.json({ error: 'Prestataire introuvable' }, { status: 404 });
    }

    // Pre-load existing sourceRefs for this (providerId, source) so dedup
    // is a single query rather than one per item.
    const existingRefs = new Set<string>();
    const existingSnap = await db
      .collection('reviews')
      .where('providerId', '==', providerId)
      .where('source', '==', source)
      .get();
    existingSnap.forEach((doc) => {
      const ref = doc.data()?.sourceRef;
      if (typeof ref === 'string' && ref.length > 0) existingRefs.add(ref);
    });

    const now = new Date();
    let created = 0;
    let createdSum = 0; // sum of clamped ratings actually created (for the report)
    let skipped = 0;
    const errors: string[] = [];

    // Batch writes (Firestore allows up to 500 ops per batch).
    let batch = db.batch();
    let opsInBatch = 0;
    const commits: Promise<unknown>[] = [];

    // Track sourceRefs seen WITHIN this payload to also dedup intra-import.
    const seenRefs = new Set<string>();

    for (let i = 0; i < reviews.length; i++) {
      const item = reviews[i];
      const sourceRef = item.sourceRef && item.sourceRef.trim().length > 0 ? item.sourceRef.trim() : null;

      if (sourceRef && (existingRefs.has(sourceRef) || seenRefs.has(sourceRef))) {
        skipped++;
        continue;
      }
      if (sourceRef) seenRefs.add(sourceRef);

      const ratingValue = clampRating(item.rating);
      const docRef = db.collection('reviews').doc();
      batch.set(docRef, {
        providerId,
        bookingId: null,
        clientId: null,
        clientEmail: null,
        memberId: null,
        clientName: '',
        clientPhoto: null,
        rating: ratingValue,
        comment: item.comment && item.comment.length > 0 ? item.comment : null,
        isPublic: true,
        imported: true,
        source,
        serviceLabel: item.serviceLabel && item.serviceLabel.length > 0 ? item.serviceLabel : null,
        sourceRef,
        createdAt: item.createdAt ?? now,
        updatedAt: now,
      });
      created++;
      createdSum += ratingValue;
      opsInBatch++;

      if (opsInBatch >= 450) {
        commits.push(batch.commit());
        batch = db.batch();
        opsInBatch = 0;
      }
    }

    if (opsInBatch > 0) commits.push(batch.commit());
    await Promise.all(commits);

    // Optional: email the provider a summary of the import. Best-effort —
    // a mail failure must never fail the import itself.
    let reportSent = false;
    if (parsed.data.notifyProvider && created > 0) {
      try {
        const providerData = providerDoc.data() || {};
        const businessName: string = providerData.businessName || 'votre établissement';
        const slug: string | undefined = providerData.slug;
        const oldRating = providerData.rating || {};
        const oldCount = typeof oldRating.count === 'number' ? oldRating.count : 0;
        const oldAvg = typeof oldRating.average === 'number' ? oldRating.average : 0;
        const newCount = oldCount + created;
        const newAvg = newCount > 0 ? (oldAvg * oldCount + createdSum) / newCount : 0;
        const avgStr = newAvg.toFixed(1).replace('.', ',');

        const userDoc = await db.collection('users').doc(providerId).get();
        const email = userDoc.data()?.email as string | undefined;

        if (email && isValidEmail(email)) {
          const pageUrl = slug ? `${appConfig.url}/p/${slug}` : appConfig.url;
          const plural = created > 1;
          const html = getEmailWrapperHtml(`
            <tr>
              <td style="padding: 0 32px 24px;">
                <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                  Bonjour ${businessName},
                </p>
                <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                  Bonne nouvelle : <strong>${created} avis</strong> ${plural ? 'ont' : 'a'} été ajouté${plural ? 's' : ''} à votre page ${appConfig.name}.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 8px 0 24px;">
                  <tr>
                    <td style="background:#f4f4f5;border-radius:12px;padding:18px 20px;text-align:center;">
                      <div style="font-size:28px;font-weight:800;color:#18181b;">${avgStr} / 5</div>
                      <div style="font-size:13px;color:#71717a;margin-top:2px;">Note moyenne · ${newCount} avis au total</div>
                    </td>
                  </tr>
                </table>
                <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #71717a;">
                  Ces avis ont été importés depuis votre historique et apparaissent désormais sur votre page publique avec la mention « Avis importé ».
                </p>
                <a href="${pageUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px;">
                  Voir ma page
                </a>
              </td>
            </tr>
          `);
          const { error: mailErr } = await resend.emails.send({
            from: emailConfig.from,
            to: email,
            replyTo: emailConfig.replyTo,
            subject: `${created} avis ajoutés à votre page ${appConfig.name}`,
            html,
          });
          reportSent = !mailErr;
          if (mailErr) console.error('[admin/reviews/import] report email error:', mailErr);
        }

        // In-app notification (shown in the bell) + ONE grouped push, via the
        // existing onAppNotificationPublish trigger (audience 'specific').
        // The trigger respects the provider's centerPushEnabled preference.
        try {
          await db.collection('appNotifications').add({
            title: 'Vos avis ont été importés',
            body: `${created} avis ajouté${created > 1 ? 's' : ''} · note ${avgStr}/5 sur ${newCount} avis`,
            type: 'announcement',
            audience: 'specific',
            targetUserId: providerId,
            targetLabel: businessName,
            iconName: 'star',
            isPublished: true,
            sendPush: true,
            createdAt: now,
            publishedAt: now,
          });
        } catch (notifErr) {
          console.error('[admin/reviews/import] in-app notification failed:', notifErr);
        }
      } catch (mailError) {
        console.error('[admin/reviews/import] report email failed:', mailError);
      }
    }

    return NextResponse.json({
      created,
      skipped,
      reportSent,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error) {
    console.error('[admin/reviews/import] Error:', error);
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
