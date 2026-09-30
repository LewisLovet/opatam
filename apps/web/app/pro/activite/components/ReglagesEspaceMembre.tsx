'use client';

/**
 * Réglages de l'espace membre (plan Studio) — onglet Équipe.
 *
 * Les invitations se font fiche par fiche (onglet « Accès à l'app ») ; ici,
 * le seul choix qui vaut pour toute l'équipe : les membres voient-ils LEUR
 * chiffre d'affaires dans l'application ? Jamais celui du salon.
 */
import { useState } from 'react';
import { Smartphone } from 'lucide-react';
import { providerService } from '@booking-app/firebase';
import type { Provider } from '@booking-app/shared';
import { Switch, useToast } from '@/components/ui';

export function ReglagesEspaceMembre({ provider }: { provider: { id: string; settings?: Provider['settings'] } }) {
  const toast = useToast();
  const [voirCA, setVoirCA] = useState(provider.settings?.memberRevenueVisible === true);
  const [occupe, setOccupe] = useState(false);

  const basculer = async (valeur: boolean) => {
    setVoirCA(valeur);
    setOccupe(true);
    try {
      await providerService.updateSettings(provider.id, { memberRevenueVisible: valeur });
      toast.success(valeur ? 'Vos membres voient leur chiffre d’affaires' : 'Chiffre d’affaires masqué pour vos membres');
    } catch (err) {
      setVoirCA(!valeur);
      toast.error('Le réglage n’a pas pu être enregistré');
      console.error('[ReglagesEspaceMembre]', err);
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
          <Smartphone className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Espace membre dans l’application</p>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Chaque membre peut avoir son propre accès : ouvrez sa fiche, onglet « Accès à l’app ».
          </p>
          <div className="mt-3">
            <Switch
              checked={voirCA}
              disabled={occupe}
              onChange={(e) => basculer(e.target.checked)}
              label="Les membres voient leur chiffre d’affaires"
              description="Seulement le leur, jamais celui du salon."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
