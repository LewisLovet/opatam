/**
 * Réponses de l'équipe non lues dans la messagerie Opatam — le compteur
 * `proUnread` du doc `supportChats/{uid}`, tenu par la Cloud Function
 * onSupportMessageCreate (remis à zéro par l'écran Messagerie).
 *
 * Un seul abonnement partagé par les trois badges : icône du hero, onglet
 * « Plus » de la barre, entrée Messagerie du menu Plus. `enabled` = résultat
 * de useSupportChatEnabled — pas d'abonnement (ni de badge) tant que le chat
 * n'est pas ouvert à ce compte.
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@booking-app/firebase';

export function useSupportUnread(uid: string | null | undefined, enabled: boolean | null): number {
  const [nonLus, setNonLus] = useState(0);

  useEffect(() => {
    if (!uid || enabled !== true) {
      setNonLus(0);
      return;
    }
    return onSnapshot(
      doc(db, 'supportChats', uid),
      (snap) => setNonLus(snap.data()?.proUnread ?? 0),
      () => setNonLus(0),
    );
  }, [uid, enabled]);

  return nonLus;
}
