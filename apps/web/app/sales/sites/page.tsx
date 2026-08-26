'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import { enTetesStaff } from '@/app/sales/entetes';
import { SALES_SECTORS } from '@booking-app/shared';
import { SECTOR_LABELS } from '@/lib/sales-leads';

/**
 * Sites web — la seconde corde à l'arc du commercial : un site vitrine
 * (400–800 €) avec la réservation Opatam intégrée, commission 50 %.
 *
 * La page explique l'offre et montre les RÉALISATIONS : le manager ajoute
 * les liens des sites livrés, le commercial les montre au prospect (aperçu
 * intégré + lien). Les aperçus sont des iframes de NOS propres sites —
 * si l'un refuse l'intégration, la carte retombe sur un lien simple.
 */

interface SiteRealise {
  id: string;
  name: string;
  url: string;
  sector: string;
  description: string;
  priceEuros: number | null;
  createdAt: string | null;
}

const PALIERS = [
  {
    prix: 400,
    nom: 'Vitrine simple',
    inclus: [
      'Une page complète : présentation, prestations, contact',
      'Réservation Opatam intégrée (le bouton qui remplit l’agenda)',
      'Adapté mobile, mise en ligne comprise',
    ],
  },
  {
    prix: 600,
    nom: 'Vitrine complète',
    inclus: [
      'Plusieurs pages : accueil, prestations, galerie, contact',
      'Réservation Opatam intégrée + fiche Google optimisée',
      'Référencement local de base (ville + métier)',
    ],
  },
  {
    prix: 800,
    nom: 'Sur mesure',
    inclus: [
      'Identité complète : design personnalisé, contenus rédigés',
      'Tout de la vitrine complète, adapté au projet',
      'Le repère haut — au-delà, devis par l’équipe',
    ],
  },
];

const ARGUMENTS = [
  'Le prospect qui hésite sur l’abonnement a souvent un problème plus visible : pas de site, ou un site honteux. Commencez par là.',
  'Le site intègre Opatam : chaque site vendu est aussi un compte Opatam qui s’active — deux ventes en une.',
  'Paiement unique, livraison par l’équipe Kamerleontech — vous vendez, on réalise.',
];

export default function SitesWebPage() {
  const [sites, setSites] = useState<SiteRealise[] | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [erreurIframes, setErreurIframes] = useState<Record<string, boolean>>({});

  // Formulaire d'ajout (manager)
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [nom, setNom] = useState('');
  const [url, setUrl] = useState('');
  const [secteur, setSecteur] = useState('');
  const [description, setDescription] = useState('');
  const [prix, setPrix] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  const charger = async () => {
    const entetes = await enTetesStaff();
    const [sitesRes, moiRes] = await Promise.all([
      fetch('/api/sales/websites', { headers: entetes }),
      fetch('/api/sales/me', { headers: entetes }),
    ]);
    if (sitesRes.ok) setSites((await sitesRes.json()).sites);
    if (moiRes.ok) setRole((await moiRes.json()).role);
  };
  useEffect(() => {
    void charger();
  }, []);

  const estManager = role === 'sales_manager' || role === 'admin';

  const ajouter = async () => {
    setEnregistrement(true);
    try {
      const res = await fetch('/api/sales/websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await enTetesStaff()) },
        body: JSON.stringify({
          name: nom.trim(),
          url: url.trim(),
          sector: secteur.trim(),
          description: description.trim(),
          priceEuros: prix.trim() ? Number(prix) : null,
        }),
      });
      if (!res.ok) {
        alert((await res.json()).error ?? 'Ajout impossible');
        return;
      }
      setNom(''); setUrl(''); setSecteur(''); setDescription(''); setPrix('');
      setAjoutOuvert(false);
      void charger();
    } finally {
      setEnregistrement(false);
    }
  };

  const supprimer = async (site: SiteRealise) => {
    if (!confirm(`Retirer « ${site.name} » du portfolio ?`)) return;
    const res = await fetch(`/api/sales/websites?id=${encodeURIComponent(site.id)}`, {
      method: 'DELETE',
      headers: await enTetesStaff(),
    });
    if (!res.ok) alert('Suppression impossible');
    void charger();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sites web</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
          La seconde offre à votre arc : un site vitrine professionnel avec la réservation
          Opatam intégrée — paiement unique, réalisation par l&apos;équipe.
        </p>
      </div>

      {/* ── La commission — l'argument du commercial d'abord ── */}
      <div className="rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-4 flex flex-wrap items-center gap-4">
        <span className="w-10 h-10 rounded-xl bg-white/15 dark:bg-gray-900/10 inline-flex items-center justify-center flex-shrink-0">
          <Wallet className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-[240px]">
          <p className="text-[15px] font-bold">Commission : 50 % du prix de vente</p>
          <p className="text-xs opacity-70 mt-0.5">
            Un site à 400 € = 200 € pour vous, versés comme vos commissions d&apos;abonnement.
            Et le compte Opatam qui va avec compte pour vos conversions.
          </p>
        </div>
        <div className="flex gap-5 text-center">
          {PALIERS.map((p) => (
            <div key={p.prix}>
              <p className="text-lg font-bold tabular-nums">{p.prix / 2} €</p>
              <p className="text-[10px] opacity-60">sur {p.prix} €</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── L'offre ── */}
      <div className="grid md:grid-cols-3 gap-3">
        {PALIERS.map((palier, i) => (
          <div
            key={palier.prix}
            className={`rounded-2xl border p-5 ${
              i === 0
                ? 'border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-900/10'
                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
            }`}
          >
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{palier.nom}</p>
              <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">
                {palier.prix} €
              </p>
            </div>
            {i === 0 && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 mt-0.5">
                L&apos;entrée de gamme — celle qu&apos;on propose d&apos;abord
              </p>
            )}
            <ul className="mt-3 space-y-1.5">
              {palier.inclus.map((ligne) => (
                <li key={ligne} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  {ligne}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ── Comment le vendre ── */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2.5">Comment le vendre</p>
        <ul className="space-y-2">
          {ARGUMENTS.map((a) => (
            <li key={a} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Check className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              {a}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-gray-400 mt-3">
          Vente conclue ? Prévenez votre manager avec le nom du client et le palier — l&apos;équipe
          prend le relais pour la réalisation et la facturation.
        </p>
      </div>

      {/* ── Les réalisations ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Nos réalisations</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              À montrer au prospect — l&apos;aperçu vaut tous les arguments.
            </p>
          </div>
          {estManager && (
            <button
              onClick={() => setAjoutOuvert((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter un site
            </button>
          )}
        </div>

        {estManager && ajoutOuvert && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 grid sm:grid-cols-2 gap-2.5">
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Nom du site / du client (ex. Institut Zoé)"
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-xs text-gray-900 dark:text-white"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-xs text-gray-900 dark:text-white"
            />
            <select
              value={secteur}
              onChange={(e) => setSecteur(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-xs text-gray-900 dark:text-white"
            >
              <option value="">Secteur — optionnel</option>
              {SALES_SECTORS.map((code) => (
                <option key={code} value={code}>
                  {SECTOR_LABELS[code] ?? code}
                </option>
              ))}
            </select>
            <input
              value={prix}
              onChange={(e) => setPrix(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="Prix vendu en € (optionnel, visible de l'équipe)"
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-xs text-gray-900 dark:text-white"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 300))}
              placeholder="Une phrase de contexte (optionnel — ex. « vitrine simple livrée en 5 jours »)"
              rows={2}
              className="sm:col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-xs text-gray-900 dark:text-gray-100"
            />
            <div className="sm:col-span-2">
              <button
                onClick={ajouter}
                disabled={enregistrement || nom.trim().length < 2 || !url.trim().startsWith('http')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {enregistrement ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Ajouter au portfolio
              </button>
            </div>
          </div>
        )}

        {sites === null ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        ) : sites.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-8 text-center">
            <Globe className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Aucune réalisation pour l&apos;instant
              {estManager ? ' — ajoutez le premier site livré.' : ' — elles arrivent.'}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {sites.map((site) => (
              <div
                key={site.id}
                className="group rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden"
              >
                {/* Aperçu : iframe de NOS sites (fallback discret si refus). */}
                <a
                  href={site.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block relative h-40 bg-gray-100 dark:bg-gray-800 overflow-hidden"
                  title={`Ouvrir ${site.name}`}
                >
                  {!erreurIframes[site.id] ? (
                    <iframe
                      src={site.url}
                      loading="lazy"
                      sandbox="allow-scripts allow-same-origin"
                      className="absolute top-0 left-0 origin-top-left pointer-events-none border-0"
                      style={{ width: '400%', height: '400%', transform: 'scale(0.25)' }}
                      onError={() => setErreurIframes((prev) => ({ ...prev, [site.id]: true }))}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Globe className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                    </div>
                  )}
                  <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-gray-900 text-xs font-semibold shadow">
                      <ExternalLink className="w-3.5 h-3.5" /> Ouvrir le site
                    </span>
                  </span>
                </a>
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {site.name}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {[
                          site.sector
                            ? (SECTOR_LABELS[site.sector as keyof typeof SECTOR_LABELS] ?? site.sector)
                            : '',
                          new URL(site.url).hostname.replace('www.', ''),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        {estManager && site.priceEuros !== null && ` · vendu ${site.priceEuros} €`}
                      </p>
                    </div>
                    {estManager && (
                      <button
                        onClick={() => void supprimer(site)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                        title="Retirer du portfolio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {site.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{site.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
