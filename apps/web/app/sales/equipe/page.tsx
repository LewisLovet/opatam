'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  Clipboard,
  Eye,
  Loader2,
  Mail,
  PartyPopper,
  Presentation,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { enTetesStaff } from '@/app/sales/entetes';

/**
 * Équipe — créer les accès commerciaux et lire les chiffres de chacun.
 *
 * Les chiffres sont les mêmes définitions que partout ailleurs : prospects
 * actifs du pipeline, démos et leurs vues, comptes créés (attributions
 * signées), abonnés payants et MRR (salesConversions). L'invitation passe
 * par la route admin existante — un manager non-admin voit l'équipe mais
 * ne crée pas d'accès.
 */

interface Chiffres {
  prospects: number;
  prospectsPerdus: number;
  demos: number;
  vuesDemos: number;
  comptesCrees: number;
  payants: number;
  payantsCeMois: number;
  mrrCents: number;
  commissionsVerseesCents: number;
}
interface Membre {
  uid: string;
  displayName: string;
  email: string;
  role: 'sales' | 'sales_manager';
  active: boolean;
  createdAt: string | null;
  objectifPayantsMensuel: number | null;
  tauxCommissionPct: number | null;
  stripeAccountStatus: string | null;
  chiffres: Chiffres;
}

/**
 * Objectif mensuel + taux de commission d'un membre — modifiables en ligne.
 * Rémunération = décision d'ADMIN : la route refuse un simple manager, et
 * l'erreur s'affiche au lieu d'être avalée.
 */
function ReglagesMembre({ membre, onEnregistre }: { membre: Membre; onEnregistre: () => void }) {
  const [objectif, setObjectif] = useState(membre.objectifPayantsMensuel?.toString() ?? '');
  const [taux, setTaux] = useState(membre.tauxCommissionPct?.toString() ?? '');
  const [envoi, setEnvoi] = useState(false);
  const modifie =
    objectif !== (membre.objectifPayantsMensuel?.toString() ?? '') ||
    taux !== (membre.tauxCommissionPct?.toString() ?? '');

  const enregistrer = async () => {
    setEnvoi(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await enTetesStaff()) },
        body: JSON.stringify({
          uid: membre.uid,
          objectifPayantsMensuel: objectif.trim() === '' ? null : parseInt(objectif, 10) || 0,
          tauxCommissionPct: taux.trim() === '' ? null : parseFloat(taux.replace(',', '.')) || 0,
        }),
      });
      if (!res.ok) {
        alert(
          res.status === 403
            ? 'La rémunération se règle avec un compte administrateur.'
            : ((await res.json()).error ?? 'Enregistrement impossible'),
        );
        return;
      }
      onEnregistre();
    } finally {
      setEnvoi(false);
    }
  };

  const mini =
    'w-14 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-1.5 py-1 text-xs text-right tabular-nums text-gray-900 dark:text-white';
  return (
    <div className="flex items-center justify-end gap-1.5">
      <input
        value={objectif}
        onChange={(e) => setObjectif(e.target.value)}
        placeholder="—"
        title="Objectif mensuel (abonnés payants)"
        className={mini}
      />
      <span className="text-[10px] text-gray-400">/mois ·</span>
      <input
        value={taux}
        onChange={(e) => setTaux(e.target.value)}
        placeholder="—"
        title="Taux de commission (% du MRR pendant 12 mois)"
        className={mini}
      />
      <span className="text-[10px] text-gray-400">%</span>
      {modifie && (
        <button
          onClick={enregistrer}
          disabled={envoi}
          className="p-1 rounded-lg bg-emerald-600 text-white disabled:opacity-50"
          title="Enregistrer"
        >
          {envoi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
}

export default function EquipePage() {
  const [team, setTeam] = useState<Membre[] | null>(null);
  const [horsEquipe, setHorsEquipe] = useState<Array<{ uid: string; chiffres: Chiffres }>>([]);
  const [refuse, setRefuse] = useState(false);

  // Invitation
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNom, setInviteNom] = useState('');
  const [inviteRole, setInviteRole] = useState<'sales' | 'sales_manager'>('sales');
  const [inviteEnCours, setInviteEnCours] = useState(false);
  const [inviteErreur, setInviteErreur] = useState<string | null>(null);
  const [inviteResultat, setInviteResultat] = useState<{
    email: string;
    emailSent: boolean;
    inviteLink: string | null;
  } | null>(null);
  const [lienCopie, setLienCopie] = useState(false);

  const charger = async () => {
    const res = await fetch('/api/sales/team', { headers: await enTetesStaff() });
    if (res.status === 403) {
      setRefuse(true);
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setTeam(data.team);
      setHorsEquipe(data.horsEquipe ?? []);
    }
  };
  useEffect(() => {
    void charger();
  }, []);

  const inviter = async () => {
    setInviteEnCours(true);
    setInviteErreur(null);
    setInviteResultat(null);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await enTetesStaff()) },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, displayName: inviteNom || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteErreur(
          res.status === 403
            ? 'La création d’accès est réservée aux administrateurs.'
            : (data.error ?? 'Erreur serveur'),
        );
        return;
      }
      setInviteResultat({
        email: inviteEmail.trim().toLowerCase(),
        emailSent: data.emailSent === true,
        inviteLink: data.inviteLink ?? null,
      });
      setInviteEmail('');
      setInviteNom('');
      void charger();
    } finally {
      setInviteEnCours(false);
    }
  };

  const basculerActif = async (m: Membre) => {
    await fetch('/api/admin/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await enTetesStaff()) },
      body: JSON.stringify({ uid: m.uid, active: !m.active }),
    });
    void charger();
  };

  const champ =
    'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white';

  if (refuse) {
    return (
      <p className="text-sm text-gray-500">
        Cette page est réservée aux managers et administrateurs.
      </p>
    );
  }

  // RIEN ne s'affiche avant la réponse du serveur : montrer le squelette
  // manager (formulaire d'invitation compris) puis le remplacer par le refus
  // laissait entrevoir une interface qui n'est pas la sienne — perçu, à
  // juste titre, comme un défaut de cloisonnement.
  if (team === null) {
    return <Loader2 className="w-5 h-5 animate-spin text-gray-400" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Équipe</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Les accès commerciaux et les chiffres de chacun — mêmes définitions que le tableau de bord.
        </p>
      </div>

      {/* ── Inviter ── */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 max-w-3xl">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
          <UserPlus className="w-4 h-4 text-gray-400" /> Inviter un commercial
        </h2>
        <div className="grid sm:grid-cols-[1fr_auto_auto_auto] gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@exemple.fr"
            className={champ}
          />
          <input
            value={inviteNom}
            onChange={(e) => setInviteNom(e.target.value)}
            placeholder="Prénom"
            className={`${champ} sm:w-36`}
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'sales' | 'sales_manager')}
            className={`${champ} sm:w-40`}
          >
            <option value="sales">Commercial</option>
            <option value="sales_manager">Manager</option>
          </select>
          <button
            onClick={inviter}
            disabled={inviteEnCours || !inviteEmail.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {inviteEnCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Inviter
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Le compte est créé immédiatement, l&apos;invitation part par e-mail avec un lien de
          définition du mot de passe qui atterrit sur l&apos;espace commercial.
        </p>
        {inviteErreur && <p className="text-sm text-red-600 mt-2">{inviteErreur}</p>}
        {inviteResultat && (
          <div className="mt-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
            <p>
              <Check className="w-4 h-4 inline mr-1 -mt-0.5" />
              Accès créé pour <strong>{inviteResultat.email}</strong>
              {inviteResultat.emailSent
                ? ' — invitation envoyée par e-mail.'
                : ' — l’e-mail n’est pas parti, transmettez le lien ci-dessous.'}
            </p>
            {inviteResultat.inviteLink && (
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteResultat.inviteLink!);
                  setLienCopie(true);
                  setTimeout(() => setLienCopie(false), 2000);
                }}
                className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
              >
                <Clipboard className="w-3 h-3" />
                {lienCopie ? 'Lien copié !' : 'Copier le lien de définition du mot de passe'}
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── L'équipe et ses chiffres ── */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 inline-flex items-center justify-center">
            <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </span>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            L&apos;équipe {team ? `· ${team.length}` : ''}
          </h2>
        </div>
        {team.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">
            Aucun commercial pour l&apos;instant — invitez le premier ci-dessus.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  <th className="px-5 py-2.5 font-semibold">Commercial</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Prospects</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Démos</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Vues</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Comptes</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Payants</th>
                  <th className="px-3 py-2.5 font-semibold text-right">MRR</th>
                  <th className="px-3 py-2.5 font-semibold text-right" title="Objectif mensuel (abonnés payants) et taux de commission (% du MRR, 12 mois)">
                    Objectif · Commission
                  </th>
                  <th className="px-5 py-2.5 font-semibold text-right">Accès</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {team.map((m) => (
                  <tr key={m.uid} className={m.active ? '' : 'opacity-50'}>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                        {m.displayName}
                        {m.role === 'sales_manager' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full">
                            <ShieldCheck className="w-2.5 h-2.5" /> Manager
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-400">{m.email}</p>
                      <p className="text-[10px] mt-0.5">
                        {m.stripeAccountStatus === 'active' ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            Versements actifs
                            {m.chiffres.commissionsVerseesCents > 0 &&
                              ` · ${(m.chiffres.commissionsVerseesCents / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} € versés`}
                          </span>
                        ) : m.stripeAccountStatus ? (
                          <span className="text-amber-600 dark:text-amber-400">Versements : configuration en cours</span>
                        ) : (
                          <span className="text-gray-400">Versements non configurés</span>
                        )}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {m.chiffres.prospects}
                      {m.chiffres.prospectsPerdus > 0 && (
                        <span className="text-[10px] text-gray-400"> (+{m.chiffres.prospectsPerdus} perdus)</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      <Presentation className="w-3 h-3 inline mr-1 -mt-0.5 text-gray-300" />
                      {m.chiffres.demos}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      <Eye className="w-3 h-3 inline mr-1 -mt-0.5 text-gray-300" />
                      {m.chiffres.vuesDemos}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {m.chiffres.comptesCrees}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {m.chiffres.payants > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          <PartyPopper className="w-3 h-3 inline mr-1 -mt-0.5" />
                          {m.chiffres.payants}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-white">
                      {(m.chiffres.mrrCents / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                    </td>
                    <td className="px-3 py-3">
                      {m.objectifPayantsMensuel !== null && (
                        <p className="text-right text-[10px] text-gray-400 mb-1">
                          ce mois : <span className={m.chiffres.payantsCeMois >= m.objectifPayantsMensuel ? 'text-emerald-600 font-semibold' : ''}>{m.chiffres.payantsCeMois}</span>/{m.objectifPayantsMensuel}
                        </p>
                      )}
                      <ReglagesMembre membre={m} onEnregistre={() => void charger()} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => basculerActif(m)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                          m.active
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-red-50 hover:text-red-600'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                        title={m.active ? 'Cliquer pour désactiver (garde l’historique)' : 'Cliquer pour réactiver'}
                      >
                        {m.active ? 'Actif' : 'Désactivé'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {horsEquipe.length > 0 && (
          <p className="px-5 py-3 text-[11px] text-gray-400 border-t border-gray-100 dark:border-gray-800">
            Chiffres hors équipe (comptes de test ou fiches supprimées) :{' '}
            {horsEquipe.map((h) => `${h.uid} — ${h.chiffres.demos} démos, ${h.chiffres.prospects} prospects`).join(' · ')}
          </p>
        )}
      </section>
    </div>
  );
}
