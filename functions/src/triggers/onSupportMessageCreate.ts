/**
 * Trigger : onSupportMessageCreate — le cœur du chat de support pro ↔ admins.
 *
 * Les clients (web pro, app mobile, interface admin) n'écrivent QUE des
 * messages ; ce trigger est la source de vérité du reste :
 *   - résumé du chat (lastMessage*, updatedAt) + compteurs de non-lus ;
 *   - message d'un PRO → e-mail aux admins, seulement quand le compteur
 *     était à zéro (première question sans réponse — pas un mail par
 *     message d'une même rafale) ;
 *   - message d'un ADMIN → push Expo au professionnel (s'il a l'app).
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendPushNotifications } from '../utils/expoPushService';
import { getResend, emailConfig, appConfig } from '../utils/resendService';

export const onSupportMessageCreate = onDocumentCreated(
  {
    document: 'supportChats/{providerId}/messages/{messageId}',
    region: 'europe-west1',
  },
  async (event) => {
    const message = event.data?.data();
    if (!message) return;
    const providerId = event.params.providerId;
    const from: 'pro' | 'admin' = message.from === 'admin' ? 'admin' : 'pro';
    const texte = typeof message.text === 'string' ? message.text : '';

    const db = admin.firestore();
    const chatRef = db.collection('supportChats').doc(providerId);

    // ── Résumé + compteurs (transaction : rafales concurrentes possibles) ──
    let premierNonLuAdmin = false;
    await db.runTransaction(async (tx) => {
      const chatSnap = await tx.get(chatRef);
      const chat = chatSnap.data() ?? {};
      if (from === 'pro') {
        premierNonLuAdmin = (chat.adminUnread ?? 0) === 0;
      }
      let businessName = chat.businessName;
      if (!businessName) {
        // Première activité : dénormaliser le nom du salon pour la liste admin.
        const prov = await tx.get(db.collection('providers').doc(providerId));
        businessName = prov.data()?.businessName ?? 'Professionnel';
      }
      // Chat neuf : compteurs explicites (pas d'increment à écraser) ;
      // chat existant : increment du bon compteur.
      const compteurs = chatSnap.exists
        ? from === 'pro'
          ? { adminUnread: FieldValue.increment(1) }
          : { proUnread: FieldValue.increment(1) }
        : {
            adminUnread: from === 'pro' ? 1 : 0,
            proUnread: from === 'admin' ? 1 : 0,
            createdAt: FieldValue.serverTimestamp(),
          };
      tx.set(
        chatRef,
        {
          providerId,
          businessName,
          lastMessageText: texte.slice(0, 200),
          lastMessageFrom: from,
          lastMessageAt: message.createdAt ?? FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          ...compteurs,
        },
        { merge: true },
      );
    });

    if (from === 'pro') {
      // ── E-mail aux admins — seulement la PREMIÈRE question sans réponse ──
      if (!premierNonLuAdmin) return;
      try {
        const adminsSnap = await db.collection('users').where('isAdmin', '==', true).get();
        const emails = adminsSnap.docs
          .map((d) => d.data().email)
          .filter((e): e is string => typeof e === 'string' && e.includes('@'));
        if (emails.length === 0) return;
        const chat = (await chatRef.get()).data();
        const nom = chat?.businessName ?? 'Un professionnel';
        await getResend().emails.send({
          from: emailConfig.from,
          to: emails,
          subject: `💬 ${nom} vous écrit sur le chat Opatam`,
          html: `
            <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#18181b;line-height:1.6;">
              <p><strong>${nom}</strong> a envoyé un message sur le chat de support :</p>
              <blockquote style="margin:12px 0;padding:10px 16px;background:#f4f4f5;border-left:3px solid #c81e3a;border-radius:0 8px 8px 0;">${texte
                .slice(0, 500)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')}</blockquote>
              <p><a href="${appConfig.url}/admin/messages" style="color:#c81e3a;font-weight:600;">Répondre dans l'interface admin →</a></p>
              <p style="color:#a1a1aa;font-size:12px;">Vous ne recevrez pas d'autre e-mail pour cette conversation tant que vous n'avez pas répondu.</p>
            </div>`,
        });
      } catch (e) {
        console.error('[supportChat] e-mail admins échoué:', e);
      }
      return;
    }

    // ── Message d'un ADMIN → push au professionnel ──
    try {
      const userSnap = await db.collection('users').doc(providerId).get();
      const tokens: string[] = userSnap.data()?.pushTokens || [];
      if (tokens.length === 0) return;
      await sendPushNotifications(tokens, {
        title: 'Opatam — nouvelle réponse 💬',
        body: texte.slice(0, 140),
        data: { type: 'support_chat' },
        sound: 'default',
      });
    } catch (e) {
      console.error('[supportChat] push pro échoué:', e);
    }
  },
);
