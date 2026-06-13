import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { resend, emailConfig, appConfig, getEmailWrapperHtml, isValidEmail } from '@/lib/resend';

/**
 * POST /api/admin/app-review-email
 *
 * Marketing tool: email selected providers (or all of them) asking them to
 * rate the Opatam mobile app on the stores. Admin-gated; sending to ALL also
 * requires the admin's confirmation code (mass send).
 *
 * Body:
 *   { mode: 'selected', recipients: { email, name? }[] }
 *   { mode: 'all', actionCode: string }
 */

// App Store numeric id (apps.apple.com/app/id6759246218). No Play Store app yet.
const APP_STORE_ID = '6759246218';

async function verifyAdmin(uid: string): Promise<boolean> {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

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
    return { ok: false, error: 'Aucun code admin défini' };
  }
  const ok = await bcrypt.compare(code, data.adminCodeHash);
  return ok ? { ok: true } : { ok: false, error: 'Code incorrect' };
}

function buildHtml(name: string | null): string {
  const appStoreUrl = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
  return getEmailWrapperHtml(`
    <tr>
      <td style="padding: 0 32px 24px;">
        <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
          Bonjour${name ? ` ${name}` : ''},
        </p>
        <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
          Vous utilisez ${appConfig.name} au quotidien — votre avis compte énormément
          pour nous&nbsp;! Si l'application vous facilite la vie, prendre 30&nbsp;secondes
          pour la noter sur l'App Store nous aide à la faire connaître à d'autres professionnels.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${appStoreUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:10px;">
            Noter sur l’App Store
          </a>
        </div>
        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #71717a;">
          Merci infiniment pour votre soutien. 💙<br />L'équipe ${appConfig.name}
        </p>
      </td>
    </tr>
  `);
}

async function sendTo(
  recipients: { email: string; name: string | null }[],
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  const subject = `Donnez votre avis sur ${appConfig.name} ⭐`;
  // Individual emails (never expose addresses to each other). Chunk to be
  // gentle with the provider's rate limits.
  const CHUNK = 20;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      chunk.map((r) =>
        resend.emails.send({
          from: emailConfig.from,
          to: r.email,
          replyTo: emailConfig.replyTo,
          subject,
          html: buildHtml(r.name),
        }),
      ),
    );
    results.forEach((res) => {
      if (res.status === 'fulfilled' && !res.value.error) sent++;
      else failed++;
    });
  }
  return { sent, failed };
}

export async function POST(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid || !(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const mode = body?.mode === 'all' ? 'all' : 'selected';
    const db = getAdminFirestore();

    let recipients: { email: string; name: string | null }[] = [];

    if (mode === 'all') {
      // Mass send → require the admin confirmation code.
      const check = await verifyAdminActionCode(adminUid, body.actionCode);
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 403 });
      }
      const usersSnap = await db.collection('users').where('role', '==', 'provider').get();
      const seen = new Set<string>();
      usersSnap.forEach((d) => {
        const email = d.data()?.email;
        const name = d.data()?.displayName || null;
        if (typeof email === 'string' && isValidEmail(email) && !seen.has(email.toLowerCase())) {
          seen.add(email.toLowerCase());
          recipients.push({ email, name });
        }
      });
    } else {
      const raw = Array.isArray(body?.recipients) ? body.recipients : [];
      const seen = new Set<string>();
      raw.forEach((r: any) => {
        const email = typeof r?.email === 'string' ? r.email.trim() : '';
        const name = typeof r?.name === 'string' && r.name.trim() ? r.name.trim() : null;
        if (isValidEmail(email) && !seen.has(email.toLowerCase())) {
          seen.add(email.toLowerCase());
          recipients.push({ email, name });
        }
      });
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'Aucun destinataire valide' }, { status: 400 });
    }

    const { sent, failed } = await sendTo(recipients);

    // Trace the campaign for the admin history.
    try {
      const adminName = (await db.collection('users').doc(adminUid).get()).data()?.displayName || null;
      await db.collection('appReviewRequests').add({
        sentAt: new Date(),
        sentByUid: adminUid,
        sentByName: adminName,
        mode,
        sent,
        failed,
        total: recipients.length,
        // Keep recipient labels for a "selected" send (capped); null for "all".
        recipientNames:
          mode === 'selected' ? recipients.map((r) => r.name || r.email).slice(0, 100) : null,
      });
    } catch (logErr) {
      console.error('[admin/app-review-email] log write failed:', logErr);
    }

    return NextResponse.json({ sent, failed, total: recipients.length });
  } catch (err: any) {
    console.error('[admin/app-review-email] error:', err);
    return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 });
  }
}

// GET — recent send history (admin history view).
export async function GET(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid || !(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }
    const db = getAdminFirestore();
    const snap = await db
      .collection('appReviewRequests')
      .orderBy('sentAt', 'desc')
      .limit(30)
      .get();
    const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ logs });
  } catch (err: any) {
    console.error('[admin/app-review-email] GET error:', err);
    return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 });
  }
}
