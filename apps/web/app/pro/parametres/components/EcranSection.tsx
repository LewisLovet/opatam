'use client';

import { useEffect, useMemo, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Monitor, Plus, Trash2, Copy, Check, ExternalLink, Tv, Tablet, Users, Lightbulb } from 'lucide-react';
import type { Location, Member } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import { auth as firebaseAuth, locationService, memberService } from '@booking-app/firebase';
import { Button, useToast } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import type { EcranResume } from '@/app/api/pro/ecrans/route';

/**
 * Paramètres › Écran du salon.
 *
 * Le pro crée un lien de lecture seule par écran (TV de l'accueil, tablette
 * du comptoir…), choisit le lieu, les membres et ce que le panneau montre,
 * puis ouvre l'URL — ou scanne le QR code — sur l'appareil. Révoquer
 * supprime le lien ; l'écran affiche alors une page introuvable.
 */

type Brouillon = { label: string; locationId: string; memberIds: string[]; upcomingCount: number; showCounters: boolean; clientDisplay: 'name' | 'service' | 'both'; theme: 'dark' | 'light' };

const AFFICHAGE_CLIENT: { id: Brouillon['clientDisplay']; label: string; aide: string }[] = [
  { id: 'both', label: 'Prénom et prestation', aide: '« Sarah M. · Balayage »' },
  { id: 'name', label: 'Prénom seul', aide: '« Sarah M. »' },
  { id: 'service', label: 'Prestation seule', aide: '« Balayage », sans nom' },
];

async function appel<T>(chemin: string, init?: RequestInit): Promise<T> {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Non connecté');
  const token = await user.getIdToken();
  const res = await fetch(chemin, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const corps = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(corps.error || 'Erreur');
  return corps;
}

function relatif(iso: string | null): string {
  if (!iso) return 'jamais ouvert';
  const delta = Date.now() - new Date(iso).getTime();
  if (delta < 2 * 60_000) return 'ouvert à l’instant';
  if (delta < 3_600_000) return `ouvert il y a ${Math.round(delta / 60_000)} min`;
  if (delta < 86_400_000) return `ouvert il y a ${Math.round(delta / 3_600_000)} h`;
  return `ouvert le ${new Date(iso).toLocaleDateString('fr-FR')}`;
}

export function EcranSection() {
  const { provider } = useAuth();
  const toast = useToast();
  const [ecrans, setEcrans] = useState<EcranResume[] | null>(null);
  const [lieux, setLieux] = useState<WithId<Location>[]>([]);
  const [membres, setMembres] = useState<WithId<Member>[]>([]);
  const [creation, setCreation] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [copie, setCopie] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState<Brouillon>({ label: '', locationId: '', memberIds: [], upcomingCount: 6, showCounters: true, clientDisplay: 'both', theme: 'dark' });

  useEffect(() => {
    if (!provider?.id) return;
    // Le toast n'entre pas dans les dépendances : son objet change à chaque
    // notification, et relancerait le chargement à chaque « Copié ».
    void appel<{ ecrans: EcranResume[] }>('/api/pro/ecrans')
      .then(({ ecrans }) => setEcrans(ecrans))
      .catch(() => { setEcrans([]); toast.error('Impossible de charger vos écrans'); });
    void Promise.all([locationService.getActiveByProvider(provider.id), memberService.getActiveByProvider(provider.id)]).then(([l, m]) => {
      setLieux(l);
      setMembres(m);
      setBrouillon((b) => ({ ...b, locationId: b.locationId || l.find((x) => x.isDefault)?.id || l[0]?.id || '' }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider?.id]);

  const membresDuLieu = useMemo(() => membres.filter((m) => m.locationId === brouillon.locationId), [membres, brouillon.locationId]);
  const nomLieu = (id: string) => lieux.find((l) => l.id === id)?.name ?? 'Lieu';

  const creer = async () => {
    if (!brouillon.label.trim() || !brouillon.locationId) { toast.error('Donnez un nom et choisissez un lieu'); return; }
    setEnCours(true);
    try {
      const { ecran } = await appel<{ ecran: EcranResume }>('/api/pro/ecrans', { method: 'POST', body: JSON.stringify({ ...brouillon, memberIds: brouillon.memberIds.length ? brouillon.memberIds : null }) });
      setEcrans((liste) => [...(liste ?? []), ecran]);
      setCreation(false);
      setBrouillon((b) => ({ ...b, label: '', memberIds: [] }));
      toast.success('Écran créé. Ouvrez le lien sur votre TV ou votre tablette.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Création impossible');
    } finally {
      setEnCours(false);
    }
  };

  const revoquer = async (ecran: EcranResume) => {
    if (!window.confirm(`Révoquer « ${ecran.label} » ? L’écran qui l’affiche ne montrera plus rien.`)) return;
    try {
      await appel('/api/pro/ecrans?id=' + encodeURIComponent(ecran.id), { method: 'DELETE' });
      setEcrans((liste) => (liste ?? []).filter((e) => e.id !== ecran.id));
      toast.success('Lien révoqué');
    } catch {
      toast.error('Révocation impossible');
    }
  };

  const copier = async (ecran: EcranResume) => {
    try {
      await navigator.clipboard.writeText(ecran.url);
      setCopie(ecran.id);
      setTimeout(() => setCopie(null), 2000);
    } catch {
      toast.error('Copie impossible');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Monitor className="w-5 h-5" /> Écran du salon</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Le planning du jour de toute l’équipe, affiché en grand sur une TV ou une tablette dans votre lieu : les rendez-vous
          par membre, les prochains clients, les chiffres de la journée. Lecture seule, aucun accès à votre espace.
        </p>
      </div>

      <div className="bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800 rounded-xl p-4 text-sm text-gray-700 dark:text-gray-300 flex gap-3">
        <Lightbulb className="w-5 h-5 shrink-0 text-primary-600" />
        <div>
          <p className="font-medium text-gray-900 dark:text-white">Confidentialité</p>
          <p>Les clientes n’apparaissent que par leur prénom et l’initiale de leur nom. Ni téléphone, ni e-mail, ni prix ne sont affichés.</p>
        </div>
      </div>

      {ecrans === null ? (
        <p className="text-sm text-gray-500">Chargement…</p>
      ) : ecrans.length === 0 && !creation ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
          <Tv className="w-10 h-10 mx-auto text-gray-400" />
          <p className="mt-3 font-medium text-gray-900 dark:text-white">Aucun écran pour l’instant</p>
          <p className="text-sm text-gray-500 mt-1">Créez un lien, ouvrez-le sur l’appareil, et laissez-le tourner.</p>
          <Button className="mt-4" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setCreation(true)}>Créer un écran</Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {ecrans.map((ecran) => (
            <li key={ecran.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex gap-4 flex-wrap sm:flex-nowrap">
              <div className="shrink-0 rounded-lg bg-white p-2 border border-gray-200">
                <QRCodeCanvas value={ecran.url} size={112} level="M" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Monitor className="w-4 h-4 text-gray-400" />{ecran.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {nomLieu(ecran.locationId)} · {ecran.memberIds ? `${ecran.memberIds.length} membre${ecran.memberIds.length > 1 ? 's' : ''}` : 'toute l’équipe'} · {ecran.upcomingCount} prochains{ecran.showCounters ? ' · compteurs' : ''} · {AFFICHAGE_CLIENT.find((a) => a.id === ecran.clientDisplay)?.label.toLowerCase()} · {ecran.theme === 'dark' ? 'sombre' : 'clair'}
                    </p>
                    <p className="text-xs text-gray-500">{relatif(ecran.lastAccessAt)}</p>
                  </div>
                  <button onClick={() => revoquer(ecran)} className="text-gray-400 hover:text-red-600 p-1" aria-label="Révoquer ce lien"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <code className="text-xs bg-gray-100 dark:bg-gray-900 rounded px-2 py-1 truncate max-w-full">{ecran.url}</code>
                  <Button size="sm" variant="outline" leftIcon={copie === ecran.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} onClick={() => copier(ecran)}>{copie === ecran.id ? 'Copié' : 'Copier'}</Button>
                  <a href={ecran.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"><ExternalLink className="w-3.5 h-3.5" /> Ouvrir</a>
                </div>
              </div>
            </li>
          ))}
          {!creation && ecrans.length < 10 && (
            <li><Button variant="outline" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setCreation(true)}>Ajouter un écran</Button></li>
          )}
        </ul>
      )}

      {creation && (
        <form className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-5" onSubmit={(e) => { e.preventDefault(); void creer(); }}>
          <h3 className="font-semibold text-gray-900 dark:text-white">Nouvel écran</h3>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Nom de l’écran</span>
            <input value={brouillon.label} onChange={(e) => setBrouillon({ ...brouillon, label: e.target.value })} placeholder="TV de l’accueil" maxLength={60} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Lieu</span>
            <select value={brouillon.locationId} onChange={(e) => setBrouillon({ ...brouillon, locationId: e.target.value, memberIds: [] })} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
              {lieux.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>

          {membresDuLieu.length > 1 && (
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1"><Users className="w-4 h-4" /> Membres affichés <span className="text-gray-400 font-normal">(aucun coché = toute l’équipe)</span></legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {membresDuLieu.map((m) => {
                  const coche = brouillon.memberIds.includes(m.id);
                  return <label key={m.id} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${coche ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}>
                    <input type="checkbox" className="sr-only" checked={coche} onChange={() => setBrouillon({ ...brouillon, memberIds: coche ? brouillon.memberIds.filter((id) => id !== m.id) : [...brouillon.memberIds, m.id] })} />
                    {m.name}
                  </label>;
                })}
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Sur chaque rendez-vous, afficher</legend>
            <div className="mt-2 grid sm:grid-cols-3 gap-2">
              {AFFICHAGE_CLIENT.map((a) => (
                <label key={a.id} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${brouillon.clientDisplay === a.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-600'}`}>
                  <input type="radio" name="clientDisplay" className="sr-only" checked={brouillon.clientDisplay === a.id} onChange={() => setBrouillon({ ...brouillon, clientDisplay: a.id })} />
                  <span className="block font-medium text-gray-900 dark:text-white">{a.label}</span>
                  <span className="block text-xs text-gray-500">{a.aide}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">Les prénoms des membres de l’équipe sont toujours affichés.</p>
          </fieldset>

          <div className="grid sm:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Prochains rendez-vous</span>
              <select value={brouillon.upcomingCount} onChange={(e) => setBrouillon({ ...brouillon, upcomingCount: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
                {[4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2">
              <input type="checkbox" checked={brouillon.showCounters} onChange={(e) => setBrouillon({ ...brouillon, showCounters: e.target.checked })} className="w-4 h-4" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Chiffres du jour</span>
            </label>
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Thème</span>
              <div className="mt-1 flex gap-2">
                {([['dark', 'Sombre', Tv], ['light', 'Clair', Tablet]] as const).map(([id, label, Icon]) => (
                  <button type="button" key={id} onClick={() => setBrouillon({ ...brouillon, theme: id })} className={`flex-1 inline-flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm ${brouillon.theme === id ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}><Icon className="w-4 h-4" />{label}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => setCreation(false)}>Annuler</Button>
            <Button type="submit" loading={enCours}>Créer le lien</Button>
          </div>
        </form>
      )}

      <p className="text-xs text-gray-500">
        Sur la TV ou la tablette, ouvrez le lien dans le navigateur puis passez en plein écran. L’écran se met à jour toute seule chaque minute et reste allumé tant que la page est visible.
      </p>
    </div>
  );
}
