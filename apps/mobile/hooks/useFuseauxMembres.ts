/**
 * Les fuseaux des membres visés par un écran, avec un état de chargement
 * EXPLICITE — jumeau du hook web du même nom.
 *
 * Avant : un `fuseau` à `undefined` voulait dire à la fois « pas encore lu »
 * et « lieu sans fuseau ». Le bouton restait actif pendant la lecture, et un
 * appui rapide partait dans le fuseau du TÉLÉPHONE.
 *
 * La table `memberId → fuseau | null` ne contient un membre qu'une fois sa
 * lecture TERMINÉE (`null` = lieu sans fuseau, cas légitime des vieux
 * lieux : on ne bloque pas un compte pour une donnée qu'il n'a pas).
 */
import { useEffect, useState } from 'react';
import { schedulingService } from '@booking-app/firebase';
import { fuseauxPrets } from '@booking-app/shared';

export function useFuseauxMembres(
  providerId: string | null | undefined,
  memberIds: string[],
): { pret: boolean; fuseaux: Record<string, string | null> } {
  const [fuseaux, setFuseaux] = useState<Record<string, string | null>>({});

  useEffect(() => { setFuseaux({}); }, [providerId]);

  const cle = [...memberIds].sort().join(',');
  useEffect(() => {
    if (!providerId) return;
    const manquants = memberIds.filter((id) => !Object.prototype.hasOwnProperty.call(fuseaux, id));
    if (manquants.length === 0) return;
    let annule = false;
    schedulingService
      .fuseauxDesMembres(providerId, manquants)
      .catch(() => Object.fromEntries(manquants.map((id) => [id, null])))
      .then((lus) => { if (!annule) setFuseaux((t) => ({ ...t, ...lus })); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, cle]);

  return { pret: fuseauxPrets(memberIds, fuseaux), fuseaux };
}
