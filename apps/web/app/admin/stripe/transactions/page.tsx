'use client';

import { useMemo, useState } from 'react';
import { Loader } from '@/components/ui';
import { Search } from 'lucide-react';
import type { StripeTx } from '@/services/admin/types';
import { useStripeData } from '../StripeDataContext';
import { TableauTransactions, Titre, eur, moisCourt } from '../components';

const POSTES: { cle: StripeTx['category'] | 'tous'; libelle: string }[] = [
  { cle: 'tous', libelle: 'Tous' },
  { cle: 'revenu', libelle: 'Revenus' },
  { cle: 'acompte', libelle: 'Acomptes' },
  { cle: 'reversement', libelle: 'Reversés au pro' },
  { cle: 'frais-connect', libelle: 'Frais Connect' },
  { cle: 'frais-billing', libelle: 'Frais Billing' },
  { cle: 'remboursement', libelle: 'Remboursements' },
  { cle: 'virement', libelle: 'Virements' },
  { cle: 'reserve', libelle: 'Fonds réservés' },
  { cle: 'autre', libelle: 'Autres' },
];

export default function TransactionsPage() {
  const { data, erreur } = useStripeData();
  const [poste, setPoste] = useState<StripeTx['category'] | 'tous'>('tous');
  const [mois, setMois] = useState<string>('tous');
  const [recherche, setRecherche] = useState('');

  const moisDispos = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.transactions.map((t) => t.created.slice(0, 7)))].sort().reverse();
  }, [data]);

  const lignes = useMemo(() => {
    if (!data) return [];
    const q = recherche.trim().toLowerCase();
    return data.transactions.filter((t) => {
      if (poste !== 'tous' && t.category !== poste) return false;
      if (mois !== 'tous' && !t.created.startsWith(mois)) return false;
      if (q) {
        const foin = `${t.description ?? ''} ${t.who ?? ''} ${t.id}`.toLowerCase();
        if (!foin.includes(q)) return false;
      }
      return true;
    });
  }, [data, poste, mois, recherche]);

  if (erreur) return <p className="text-red-600">{erreur}</p>;
  if (!data) return <Loader />;

  const brut = lignes.reduce((s, t) => s + t.amount, 0);
  const frais = lignes.reduce((s, t) => s + t.fee, 0);

  return (
    <div className="space-y-6">
      <Titre note="Le relevé brut, tel que Stripe l'enregistre. Chaque total des autres onglets se retrouve ici.">
        Relevé complet
      </Titre>

      <div className="flex flex-wrap gap-2">
        {POSTES.map((p) => (
          <button
            key={p.cle}
            type="button"
            onClick={() => setPoste(p.cle)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              poste === p.cle
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {p.libelle}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un prestataire, un libellé, un identifiant…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400"
          />
        </div>
        <select
          value={mois}
          onChange={(e) => setMois(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        >
          <option value="tous">Tous les mois</option>
          {moisDispos.map((m) => (
            <option key={m} value={m}>{moisCourt(m)}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-6 text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          {lignes.length} ligne{lignes.length > 1 ? 's' : ''}
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          Somme des montants :{' '}
          <span className={`font-semibold tabular-nums ${
            brut < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
          }`}>
            {eur(brut)}
          </span>
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          Frais de traitement :{' '}
          <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">{eur(-frais)}</span>
        </span>
      </div>

      {/* Le montant est brut : sur les encaissements, les frais s'en déduisent.
          C'est pourquoi les deux colonnes restent séparées jusqu'au bout. */}
      <TableauTransactions transactions={lignes} vide="Aucune transaction ne correspond à ces filtres." />

      <p className="text-xs text-gray-400">
        Relevé arrêté au {new Date(data.generatedAt).toLocaleString('fr-FR')} · {data.transactions.length} lignes,
        soit l&apos;intégralité du solde de la plateforme depuis son ouverture. Les paiements encaissés
        directement sur les comptes prestataires n&apos;y figurent pas : ils ne transitent jamais par ce compte.
      </p>
    </div>
  );
}
