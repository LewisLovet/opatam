'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';
import {
  ArrowLeft,
  Camera,
  Check,
  Clipboard,
  ExternalLink,
  Eye,
  ImagePlus,
  Loader2,
  Mail,
  Palette,
  PartyPopper,
  Scissors,
  Send,
  MonitorSmartphone,
  Store,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { parseDemoConfig } from '@/lib/sales-demo';
import { generateSalesDemoEmail } from '@/lib/emails/salesDemo';
import { GoogleAddressAutocomplete, type GoogleAddressSuggestion } from '@/components/ui/GoogleAddressAutocomplete';
import { ApercuPrestations, type ConfigEurosDemo } from '../components/ApercuPrestations';
import { ChoixTheme } from '../components/ChoixTheme';

/**
 * La fiche d'une démo — tout ce qui se modifie, au même endroit.
 *
 * Identité, photos, couleur, prestations, envoi : le commercial prépare et
 * fait vivre la page de son prospect ici, sans jamais retoucher de JSON —
 * sauf s'il veut re-passer par l'IA, auquel cas la zone de collage est un
 * repli assumé en bas de page.
 *
 * L'enregistrement resérialise la config (euros) et repasse par la MÊME
 * validation que la création : une seule frontière, pas de chemin dérobé.
 */

interface Detail {
  id: string;
  url: string;
  businessName: string;
  coverUrl: string | null;
  fromName: string | null;
  configEuros: ConfigEurosDemo;
  photos: { logo: string | null; cover: string | null };
  views: number;
  lastViewedAt: string | null;
  sentTo: string[];
  claimedProviderName: string | null;
  expiresAt: string | null;
  expired: boolean;
}

const SECTEURS = [
  ['coiffure', 'Coiffure'],
  ['barbier', 'Barbier'],
  ['ongles', 'Onglerie'],
  ['esthetique', 'Esthétique'],
  ['maquillage', 'Maquillage'],
  ['massage', 'Massage & bien-être'],
  ['tatouage', 'Tatouage'],
  ['autre', 'Autre'],
] as const;

async function jeton(): Promise<Record<string, string>> {
  const t = await getAuth().currentUser?.getIdToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function depuis(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `il y a ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? 'hier' : `il y a ${j} j`;
}

function Section({
  icone: Icone,
  titre,
  sousTitre,
  children,
  actions,
}: {
  icone: React.ComponentType<{ className?: string }>;
  titre: string;
  sousTitre?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 inline-flex items-center justify-center">
            <Icone className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{titre}</h2>
            {sousTitre && <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{sousTitre}</p>}
          </div>
        </div>
        {actions}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export default function DemoEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [introuvable, setIntrouvable] = useState(false);
  // La config éditée (euros) — source unique de tout ce que la page modifie.
  const [config, setConfig] = useState<ConfigEurosDemo | null>(null);
  const [themeChoisi, setThemeChoisi] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [uploadEnCours, setUploadEnCours] = useState<'logo' | 'cover' | null>(null);
  const [envoiEmail, setEnvoiEmail] = useState('');
  const [envoiMessage, setEnvoiMessage] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [envoiFait, setEnvoiFait] = useState(false);
  const [collage, setCollage] = useState('');
  const [collageOuvert, setCollageOuvert] = useState(false);
  const [lienCopie, setLienCopie] = useState(false);
  const [apercuPage, setApercuPage] = useState(false);
  const [apercuMail, setApercuMail] = useState(false);
  // Incrémenté à chaque enregistrement : l'iframe d'aperçu se recharge.
  const [versionApercu, setVersionApercu] = useState(0);
  // Référence de l'état chargé, pour savoir si quelque chose a changé.
  const chargeRef = useRef<string>('');

  const charger = useCallback(async () => {
    const res = await fetch(`/api/sales/demos?id=${id}`, { headers: await jeton() });
    if (!res.ok) {
      setIntrouvable(true);
      return;
    }
    const d: Detail = await res.json();
    setDetail(d);
    const { themeId, ...sansTheme } = d.configEuros;
    setConfig(sansTheme as ConfigEurosDemo);
    setThemeChoisi(typeof themeId === 'string' ? themeId : '');
    chargeRef.current = JSON.stringify({ c: sansTheme, t: themeId ?? '' });
  }, [id]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const modifie = useMemo(() => {
    if (!config) return false;
    return chargeRef.current !== JSON.stringify({ c: config, t: themeChoisi });
  }, [config, themeChoisi]);

  const enregistrer = async () => {
    if (!config) return;
    setEnregistrement(true);
    setErreurs([]);
    setEnregistre(false);
    try {
      const res = await fetch('/api/sales/demos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await jeton()) },
        body: JSON.stringify({ id, pasted: JSON.stringify(config), themeId: themeChoisi || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreurs(data.erreurs ?? [data.error ?? 'Erreur serveur']);
        return;
      }
      setEnregistre(true);
      setTimeout(() => setEnregistre(false), 2500);
      setVersionApercu((v) => v + 1);
      void charger();
    } finally {
      setEnregistrement(false);
    }
  };

  const televerser = async (kind: 'logo' | 'cover', file: File) => {
    setUploadEnCours(kind);
    try {
      const form = new FormData();
      form.set('id', id);
      form.set('kind', kind);
      form.set('file', file);
      const res = await fetch('/api/sales/demos/upload', { method: 'POST', headers: await jeton(), body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErreurs([data.error ?? 'Téléversement impossible']);
        return;
      }
      void charger();
    } finally {
      setUploadEnCours(null);
    }
  };

  const envoyer = async () => {
    if (!envoiEmail.trim()) return;
    setEnvoiEnCours(true);
    try {
      const res = await fetch('/api/sales/demos/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await jeton()) },
        body: JSON.stringify({ id, email: envoiEmail, message: envoiMessage.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreurs([data.error ?? 'Envoi impossible']);
        return;
      }
      setEnvoiFait(true);
      setEnvoiEmail('');
      setEnvoiMessage('');
      setTimeout(() => setEnvoiFait(false), 3000);
      void charger();
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const appliquerCollage = () => {
    const r = parseDemoConfig(collage);
    if (!r.ok) {
      setErreurs(r.erreurs);
      return;
    }
    setErreurs([]);
    // Le collage BRUT part au serveur, qui revalide et remplace tout :
    // même frontière que la création, aucune conversion locale à maintenir.
    void (async () => {
      setEnregistrement(true);
      try {
        const res = await fetch('/api/sales/demos', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...(await jeton()) },
          body: JSON.stringify({ id, pasted: collage, themeId: themeChoisi || null }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErreurs(data.erreurs ?? [data.error ?? 'Erreur serveur']);
          return;
        }
        setCollage('');
        setCollageOuvert(false);
        setEnregistre(true);
        setTimeout(() => setEnregistre(false), 2500);
        void charger();
      } finally {
        setEnregistrement(false);
      }
    })();
  };

  const supprimer = async () => {
    if (!confirm('Supprimer définitivement cette démo ? Le lien cessera de fonctionner.')) return;
    await fetch(`/api/sales/demos?id=${id}`, { method: 'DELETE', headers: await jeton() });
    router.push('/sales/demo');
  };

  const copierLien = async () => {
    if (!detail) return;
    await navigator.clipboard.writeText(detail.url);
    setLienCopie(true);
    setTimeout(() => setLienCopie(false), 2000);
  };

  if (introuvable) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-gray-500">Cette démo n&apos;existe pas ou ne vous appartient pas.</p>
        <Link href="/sales/demo" className="text-sm text-red-600 hover:underline mt-2 inline-block">
          ← Retour au centre de démonstration
        </Link>
      </div>
    );
  }
  if (!detail || !config) {
    return <Loader2 className="w-5 h-5 animate-spin text-gray-400" />;
  }

  const majChamp = (champ: 'businessName' | 'city' | 'description' | 'sector', valeur: string) =>
    setConfig((prev) => (prev ? { ...prev, [champ]: valeur } : prev));

  return (
    <div className="space-y-5 pb-24">
      {/* ── En-tête ── */}
      <div>
        <Link
          href="/sales/demo"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Centre de démonstration
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
              {config.businessName}
              {detail.claimedProviderName && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full">
                  <PartyPopper className="w-3 h-3" /> Compte créé
                </span>
              )}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-400">
              <span className={`inline-flex items-center gap-1 ${detail.views > 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
                <Eye className="w-3.5 h-3.5" />
                {detail.views === 0
                  ? 'jamais ouverte par le prospect'
                  : `${detail.views} vue${detail.views > 1 ? 's' : ''}${detail.lastViewedAt ? ` · ${depuis(detail.lastViewedAt)}` : ''}`}
              </span>
              {detail.sentTo.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> envoyée à {detail.sentTo[detail.sentTo.length - 1]}
                </span>
              )}
              <span>
                {detail.expired
                  ? 'expirée — enregistrez pour la réactiver 30 jours'
                  : detail.expiresAt
                    ? `expire le ${new Date(detail.expiresAt).toLocaleDateString('fr-FR')}`
                    : ''}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setApercuPage(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <MonitorSmartphone className="w-3.5 h-3.5" /> Aperçu
            </button>
            <button
              onClick={copierLien}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {lienCopie ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Clipboard className="w-3.5 h-3.5" />}
              {lienCopie ? 'Copié' : 'Copier le lien'}
            </button>
            <a
              href={detail.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold hover:opacity-90"
            >
              Voir la démo <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {erreurs.length > 0 && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
          <ul className="text-sm text-red-700 dark:text-red-400 space-y-0.5">
            {erreurs.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid xl:grid-cols-2 gap-5 items-start">
      <div className="space-y-5">
      {/* ── Photos ── */}
      <Section
        icone={Camera}
        titre="Photos"
        sousTitre="Le logo remplace le portrait rond, la couverture remplace l'image du secteur"
      >
        <div className="flex flex-wrap items-start gap-5">
          {/* Couverture */}
          <label className="group relative block w-full sm:w-72 aspect-[16/7] rounded-xl overflow-hidden cursor-pointer border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            {detail.photos.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.photos.cover} alt="Couverture" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-gray-400">
                <ImagePlus className="w-6 h-6" />
                <span className="text-[11px]">Photo de couverture</span>
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-gray-950/0 group-hover:bg-gray-950/50 transition-colors">
              <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium transition-opacity">
                {uploadEnCours === 'cover' ? 'Envoi…' : detail.photos.cover ? 'Remplacer' : 'Ajouter'}
              </span>
            </span>
            {uploadEnCours === 'cover' && (
              <span className="absolute inset-0 flex items-center justify-center bg-gray-950/40">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </span>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploadEnCours !== null}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void televerser('cover', f);
                e.target.value = '';
              }}
            />
          </label>

          {/* Logo */}
          <label className="group relative block w-24 h-24 rounded-full overflow-hidden cursor-pointer border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
            {detail.photos.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.photos.logo} alt="Logo" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-gray-400">
                <ImagePlus className="w-5 h-5" />
                <span className="text-[10px]">Logo</span>
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-gray-950/0 group-hover:bg-gray-950/50 transition-colors">
              <span className="opacity-0 group-hover:opacity-100 text-white text-[10px] font-medium transition-opacity">
                {uploadEnCours === 'logo' ? 'Envoi…' : detail.photos.logo ? 'Remplacer' : 'Ajouter'}
              </span>
            </span>
            {uploadEnCours === 'logo' && (
              <span className="absolute inset-0 flex items-center justify-center bg-gray-950/40">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </span>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploadEnCours !== null}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void televerser('logo', f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        <p className="mt-3 text-[11px] text-gray-400">
          JPEG, PNG ou WebP — 5 Mo max. Visible immédiatement sur la démo, sans réenregistrer.
        </p>
      </Section>

      {/* ── Identité ── */}
      <Section icone={Store} titre="Identité" sousTitre="Ce que la page affiche en tête">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Nom de l&apos;établissement
            </label>
            <input
              value={config.businessName}
              onChange={(e) => majChamp('businessName', e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ville</label>
            {/* Même autocomplete que l'inscription : une ville qui existe,
                pas une saisie libre. */}
            <GoogleAddressAutocomplete
              value={config.city ?? ''}
              onChange={(v) => majChamp('city', v)}
              onSelect={(sug: GoogleAddressSuggestion) => majChamp('city', sug.locality ?? sug.formattedAddress ?? '')}
              placeholder="Rechercher une ville..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Secteur <span className="font-normal text-gray-400">(pilote les photos par défaut)</span>
            </label>
            <select
              value={config.sector ?? 'autre'}
              onChange={(e) => majChamp('sector', e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              {SECTEURS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Présentation de l&apos;enseigne <span className="font-normal text-gray-400">(affichée sous le nom, en tête de page)</span>
            </label>
            <textarea
              value={config.description ?? ''}
              onChange={(e) => majChamp('description', e.target.value.slice(0, 500))}
              rows={2}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </Section>

      {/* ── Couleur ── */}
      <Section icone={Palette} titre="Couleur de la page" sousTitre="Boutons, badges et accents de la démo">
        <ChoixTheme valeur={themeChoisi} brandColor={config.brandColor} onChange={setThemeChoisi} />
      </Section>

      </div>
      <div className="space-y-5">
      {/* ── Prestations ── */}
      <Section
        icone={Scissors}
        titre="Prestations"
        sousTitre="Telles que le prospect les verra"
        actions={
          <button
            onClick={() => setCollageOuvert((o) => !o)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <Wand2 className="w-3.5 h-3.5" /> Remplacer via l&apos;IA
          </button>
        }
      >
        {collageOuvert && (
          <div className="mb-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
              Collez une nouvelle réponse de l&apos;IA (même prompt) : elle remplace l&apos;ensemble des
              prestations, l&apos;identité et la couleur relevée.
            </p>
            <textarea
              value={collage}
              onChange={(e) => setCollage(e.target.value)}
              rows={5}
              placeholder='{ "businessName": "…", "categories": [ … ] }'
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-2.5 font-mono text-xs text-gray-900 dark:text-gray-100"
            />
            <button
              onClick={appliquerCollage}
              disabled={!collage.trim() || enregistrement}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-medium disabled:opacity-50"
            >
              {enregistrement ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Appliquer le remplacement
            </button>
          </div>
        )}
        <ApercuPrestations config={config} />
      </Section>

      {/* ── Envoi ── */}
      <Section
        icone={Send}
        titre="Envoyer au prospect"
        sousTitre={
          detail.sentTo.length > 0
            ? `Déjà envoyée à : ${[...new Set(detail.sentTo)].join(', ')}`
            : 'E-mail préfait avec le lien de la démo'
        }
      >
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={envoiEmail}
              onChange={(e) => setEnvoiEmail(e.target.value)}
              placeholder="email-du-prospect@exemple.fr"
              className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white"
            />
            <button
              onClick={envoyer}
              disabled={envoiEnCours || !envoiEmail.trim() || detail.expired}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {envoiEnCours ? <Loader2 className="w-4 h-4 animate-spin" /> : envoiFait ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              {envoiFait ? 'Envoyé' : 'Envoyer'}
            </button>
          </div>
          <textarea
            value={envoiMessage}
            onChange={(e) => setEnvoiMessage(e.target.value.slice(0, 600))}
            placeholder="Un mot personnel en tête d'e-mail (optionnel) — « Ravi de notre échange de ce matin… »"
            rows={2}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-xs text-gray-900 dark:text-gray-100"
          />
          <button
            onClick={() => setApercuMail(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <Eye className="w-3.5 h-3.5" /> Voir l&apos;e-mail qui sera envoyé
            {envoiMessage.trim() ? ' (avec votre mot personnel)' : ''}
          </button>
          {detail.expired && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Démo expirée — enregistrez une modification pour la réactiver avant d&apos;envoyer.
            </p>
          )}
        </div>
      </Section>

      {/* ── Suppression ── */}
      <div className="flex justify-end">
        <button
          onClick={supprimer}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-600 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Supprimer cette démo
        </button>
      </div>
      </div>
      </div>

      {/* ── Aperçu de la page — l'iframe montre la VRAIE démo ── */}
      {apercuPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm" onClick={() => setApercuPage(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden w-[400px] max-w-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Ce que verra le prospect
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={detail.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 inline-flex items-center gap-1"
                >
                  Plein écran <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => setApercuPage(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Format téléphone : c'est ainsi que 90 % des prospects la verront. */}
            <iframe
              key={versionApercu}
              src={detail.url}
              title="Aperçu de la démo"
              className="block w-[400px] max-w-full h-[70vh] bg-white"
            />
          </div>
        </div>
      )}

      {/* ── Aperçu de l'e-mail — le gabarit RÉEL, mot personnel compris ── */}
      {apercuMail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm" onClick={() => setApercuMail(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden w-[620px] max-w-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  L&apos;e-mail que recevra le prospect
                </p>
                <p className="text-[11px] text-gray-400">
                  Objet : Votre future page de réservation est prête — {config.businessName}
                </p>
              </div>
              <button
                onClick={() => setApercuMail(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <iframe
              title="Aperçu de l'e-mail"
              srcDoc={
                generateSalesDemoEmail({
                  businessName: config.businessName,
                  demoUrl: detail.url,
                  coverUrl: detail.photos.cover ?? detail.coverUrl,
                  expiresLe: detail.expiresAt
                    ? new Date(detail.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                    : 'dans 30 jours',
                  fromName: detail.fromName,
                  message: envoiMessage.trim() || null,
                }).html
              }
              className="block w-full h-[70vh] bg-[#f4f2f0]"
            />
          </div>
        </div>
      )}

      {/* ── Barre d'enregistrement — n'apparaît que s'il y a quelque chose à sauver ── */}
      {(modifie || enregistre) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 lg:left-[calc(50%+8rem)] z-40">
          <div className="flex items-center gap-3 rounded-full bg-gray-900/95 dark:bg-gray-800/95 backdrop-blur pl-5 pr-2 py-2 shadow-xl">
            <span className="text-sm text-gray-200">
              {enregistre ? 'Enregistré — la démo est à jour.' : 'Modifications non enregistrées'}
            </span>
            {!enregistre && (
              <button
                onClick={enregistrer}
                disabled={enregistrement}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 disabled:opacity-60"
              >
                {enregistrement ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Enregistrer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
