'use client';

/**
 * Les fuseaux des membres visés par un formulaire, avec un état de
 * chargement EXPLICITE.
 *
 * Avant : un `fuseau` à `undefined` voulait dire à la fois « pas encore lu »
 * et « lieu sans fuseau ». Le bouton Enregistrer restait cliquable pendant
 * la lecture, et un clic rapide partait dans le fuseau de l'APPAREIL.
 *
 * Ici, la table `memberId → fuseau | null` ne contient un membre qu'une fois
 * sa lecture TERMINÉE (`null` = lieu sans fuseau, cas légitime des vieux
 * lieux). `pret` est vrai quand tous les membres visés y sont —
 * `fuseauxPrets`, testé dans le paquet partagé. Les membres déjà lus ne
 * sont pas relus quand la sélection change.
 */
import { useEffect, useState } from 'react';
import { schedulingService } from '@booking-app/firebase';
import { fuseauxPrets } from '@booking-app/shared';

export function useFuseauxMembres(
  providerId: string,
  memberIds: string[],
  actif: boolean,
): { pret: boolean; fuseaux: Record<string, string | null> } {
  const [fuseaux, setFuseaux] = useState<Record<string, string | null>>({});

  // Un autre prestataire, une autre table.
  useEffect(() => { setFuseaux({}); }, [providerId]);

  const cle = [...memberIds].sort().join(',');
  useEffect(() => {
    if (!actif || !providerId) return;
    const manquants = memberIds.filter((id) => !Object.prototype.hasOwnProperty.call(fuseaux, id));
    if (manquants.length === 0) return;
    let annule = false;
    schedulingService
      .fuseauxDesMembres(providerId, manquants)
      .catch(() => Object.fromEntries(manquants.map((id) => [id, null])))
      .then((lus) => { if (!annule) setFuseaux((t) => ({ ...t, ...lus })); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, cle, actif]);

  return { pret: fuseauxPrets(memberIds, fuseaux), fuseaux };
}
