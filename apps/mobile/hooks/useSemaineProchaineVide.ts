/**
 * useSemaineProchaineVide — qui, parmi les membres en horaires variables,
 * n'a encore RIEN ouvert pour la semaine prochaine. Alimente les badges
 * (accueil du membre, menu, Disponibilités, équipe).
 *
 * Relu à chaque retour sur l'écran : le badge disparaît dès que la semaine
 * est remplie. En espace membre, seul le membre connecté compte.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { schedulingService } from '@booking-app/firebase';

export function useSemaineProchaineVide(providerId: string | null | undefined, monMemberId?: string | null) {
  const [etat, setEtat] = useState<{ lundi: string | null; memberIds: string[] }>({ lundi: null, memberIds: [] });

  useFocusEffect(
    useCallback(() => {
      if (!providerId) return;
      let annule = false;
      schedulingService
        .getSemaineProchaineVide(providerId)
        .then((r) => {
          if (annule) return;
          setEtat({ lundi: r.lundi, memberIds: monMemberId ? r.memberIds.filter((id) => id === monMemberId) : r.memberIds });
        })
        // Un badge est un confort : une lecture ratée n'affiche simplement rien.
        .catch(() => undefined);
      return () => {
        annule = true;
      };
    }, [providerId, monMemberId]),
  );

  return etat;
}
