/**
 * Trigger : un code d'accès apparaît dans une fiche membre → on le range.
 *
 * La fiche d'un membre est en lecture publique (la page du salon affiche
 * l'équipe) ; son code d'accès au planning n'a rien à y faire. L'app et le
 * site à jour ne l'y écrivent plus (`memberAccessCodes`), mais une ancienne
 * version de l'app, qui n'a pas reçu la mise à jour, continue de le faire
 * en créant un membre ou en régénérant son code. Ce trigger le déplace
 * aussitôt et l'efface de la fiche.
 *
 * Fiche supprimée (ancienne app) → ses codes sont retirés : plus aucun
 * planning ne s'ouvre avec.
 *
 * L'effacement du champ réécrit la fiche, donc redéclenche ce trigger :
 * le champ n'y est plus, il ne fait rien. Pas de boucle.
 */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { rangerCodeAcces, retirerCodesDuMembre } from '../lib/codesAcces';

export const onMemberWriteAccessCode = onDocumentWritten(
  {
    document: 'providers/{providerId}/members/{memberId}',
    region: 'europe-west1',
  },
  async (event) => {
    const providerId = event.params.providerId as string;
    const memberId = event.params.memberId as string;
    try {
      const apres = event.data?.after;
      if (!apres?.exists) {
        const retires = await retirerCodesDuMembre(admin.firestore(), providerId, memberId);
        if (retires) console.log(`[onMemberWriteAccessCode] ${providerId}/${memberId} supprimé : ${retires} code(s) retiré(s)`);
        return;
      }
      // Le cas courant (nom, photo, horaires…) : aucune lecture.
      const brut = apres.get('accessCode');
      if (typeof brut !== 'string' || !brut) return;

      const r = await rangerCodeAcces(admin.firestore(), providerId, memberId);
      console.log(`[onMemberWriteAccessCode] ${providerId}/${memberId} : ${r.action}`);
    } catch (err) {
      // Ne jamais lever : le trigger serait rejoué en boucle. La migration
      // (relançable) rattrape une fiche restée avec son code.
      console.error('[onMemberWriteAccessCode] failed', providerId, memberId, err);
    }
  },
);
