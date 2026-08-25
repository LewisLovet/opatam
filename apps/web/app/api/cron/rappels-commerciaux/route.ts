import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { STAGE_LABELS } from '@/lib/sales-leads';

/**
 * Cron quotidien (vercel.json) — le rappel « prochain contact » des fiches
 * prospects, par e-mail au commercial.
 *
 * Un rappel posé sur une fiche ne sert à rien si personne ne le voit : le
 * tableau de bord l'affiche, cet e-mail le pousse. Un même rappel n'est
 * envoyé qu'UNE fois (rappelEnvoyeAt ≥ nextActionAt = déjà notifié) — le
 * commercial qui repousse la date réarme la notification.
 *
 * Auth : l'en-tête Authorization: Bearer <CRON_SECRET> que Vercel joint
 * automatiquement à ses crons quand la variable existe.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const db = getAdminFirestore();
  const maintenant = new Date();
  const snap = await db
    .collection('salesLeads')
    .where('nextActionAt', '<=', maintenant)
    .limit(500)
    .get();

  // À notifier : rappel dû, fiche vivante, pas encore signalé pour CETTE échéance.
  const dus = snap.docs.filter((d) => {
    const x = d.data();
    if (x.lostReason || !x.ownerUid) return false;
    const rappele = x.rappelEnvoyeAt?.toDate?.()?.getTime() ?? 0;
    const echeance = x.nextActionAt?.toDate?.()?.getTime() ?? 0;
    return rappele < echeance;
  });
  if (dus.length === 0) return NextResponse.json({ envoyes: 0 });

  const parCommercial = new Map<string, typeof dus>();
  dus.forEach((d) => {
    const uid = d.data().ownerUid as string;
    if (!parCommercial.has(uid)) parCommercial.set(uid, []);
    parCommercial.get(uid)!.push(d);
  });

  const resendApiKey = process.env.RESEND_API_KEY;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com';
  let envoyes = 0;

  for (const [uid, fiches] of parCommercial) {
    const staff = (await db.collection('staffMembers').doc(uid).get()).data();
    if (!staff?.email || staff.active !== true) continue;

    const lignes = fiches
      .map((d) => {
        const x = d.data();
        const infos = [
          STAGE_LABELS[x.stage as keyof typeof STAGE_LABELS] ?? x.stage,
          x.contactName,
          x.phone,
        ]
          .filter(Boolean)
          .join(' · ');
        return `<li style="margin:0 0 10px;">
          <a href="${baseUrl}/sales/pipeline?lead=${d.id}" style="font-weight:600;color:#18181b;text-decoration:none;">${x.businessName}</a>
          <span style="color:#71717a;font-size:13px;"> — ${infos}</span>
        </li>`;
      })
      .join('');

    if (resendApiKey) {
      try {
        const { Resend } = await import('resend');
        await new Resend(resendApiKey).emails.send({
          from: 'Opatam <noreply@kamerleontech.com>',
          to: staff.email,
          subject: `${fiches.length} prospect${fiches.length > 1 ? 's' : ''} à relancer aujourd'hui`,
          html: `
  <div style="margin:0;padding:24px 12px;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e6e6e8;padding:28px 32px;">
      <h1 style="margin:0 0 14px;font-size:19px;color:#18181b;">À relancer aujourd'hui</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">
        Les rappels que vous avez posés sur vos fiches arrivent à échéance :
      </p>
      <ul style="margin:0 0 20px;padding-left:18px;font-size:15px;">${lignes}</ul>
      <a href="${baseUrl}/sales/pipeline" style="display:inline-block;background:#c81e3a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:10px;">Ouvrir mon pipeline</a>
    </div>
  </div>`,
        });
        envoyes += 1;
      } catch (e) {
        console.warn('[cron/rappels] e-mail échoué pour', uid, e);
        continue; // ne pas marquer : le rappel repartira demain
      }
    }
    // Marquer pour ne pas renvoyer le même rappel chaque jour.
    const batch = db.batch();
    fiches.forEach((d) => batch.update(d.ref, { rappelEnvoyeAt: FieldValue.serverTimestamp() }));
    await batch.commit();
  }

  return NextResponse.json({ envoyes, fichesDues: dus.length });
}
