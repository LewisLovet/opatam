'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, useToast } from '@/components/ui';
import { providerService } from '@booking-app/firebase';
import {
  SUPPORTED_CURRENCIES,
  DEFAULT_CURRENCY,
  getCurrency,
  formatPrice,
} from '@booking-app/shared';

/**
 * Devise d'affichage et d'encaissement.
 *
 * Changer la devise NE CONVERTIT RIEN : les prix sont stockés en unités
 * mineures sans devise, donc « 35,00 € » devient « 35,00 CHF ». C'est un
 * choix assumé — une conversion au taux du jour donnerait des prix à
 * virgule que personne n'affiche — mais il faut le dire noir sur blanc
 * AVANT de valider, pas après.
 */
export function DeviseSection() {
  const { provider, refreshProvider } = useAuth();
  const toast = useToast();

  const actuelle = provider?.currency ?? DEFAULT_CURRENCY;
  const [choix, setChoix] = useState(actuelle);
  const [enCours, setEnCours] = useState(false);

  const change = choix !== actuelle;
  const avant = getCurrency(actuelle);
  const apres = getCurrency(choix);

  const enregistrer = async () => {
    if (!provider || !change) return;
    setEnCours(true);
    try {
      await providerService.updateProvider(provider.id, { currency: choix });
      await refreshProvider?.();
      toast.success(`Devise enregistrée : ${apres.label}`);
    } catch (error) {
      console.error('Devise:', error);
      toast.error('La devise n’a pas pu être enregistrée');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Devise</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Vos prix sont affichés et encaissés dans cette devise, y compris les acomptes.
        </p>
      </div>

      <div>
        <label
          htmlFor="devise-reglage"
          className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Devise de vos prix
        </label>
        <select
          id="devise-reglage"
          value={choix}
          disabled={enCours}
          onChange={(e) => setChoix(e.target.value)}
          // Une molette au-dessus d'un select natif change sa valeur : ici
          // ce n'est qu'un brouillon, mais autant ne pas surprendre.
          onWheel={(e) => e.currentTarget.blur()}
          className="w-full max-w-sm rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          {SUPPORTED_CURRENCIES.map((d) => (
            <option key={d.code} value={d.code}>
              {d.label} ({d.symbol})
            </option>
          ))}
        </select>
      </div>

      {change && (
        <div className="flex items-start gap-3 rounded-xl border border-warning-300 bg-warning-50 p-4 dark:border-warning-800 dark:bg-warning-950/20">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-warning-600 dark:text-warning-400" />
          <div className="min-w-0 space-y-2 text-sm">
            <p className="font-semibold text-gray-900 dark:text-white">
              Vos prix ne seront pas convertis.
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              Un tarif affiché {formatPrice(3500, avant.code)} deviendra{' '}
              <strong>{formatPrice(3500, apres.code)}</strong>, pas sa contre-valeur.
              À vous de retoucher vos prix après le changement.
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              Les rendez-vous déjà pris et les acomptes déjà encaissés gardent leur
              montant et leur devise d’origine.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={enregistrer} disabled={!change || enCours}>
          {enCours ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Enregistrer la devise
        </Button>
        {!change && (
          <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <Check className="h-4 w-4 text-success-500" />
            {avant.label} ({avant.symbol})
          </span>
        )}
      </div>
    </div>
  );
}
