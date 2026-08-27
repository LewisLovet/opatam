'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Calculator,
  Check,
  ExternalLink,
  HelpCircle,
  MessageCircle,
  Quote,
  Shield,
  Clipboard,
} from 'lucide-react';
import { OPATAM_PRIX, type Battlecard } from './battlecards';

function euros(n: number): string {
  // Toujours deux décimales : « 19,90 € », jamais « 19,9 € » — un prix
  // tronqué fait amateur dans un outil qui vend la rigueur.
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Le rendu d'une battlecard — partagé entre la page Bibliothèque et la
 * MODALE de la fiche prospect (l'argumentaire s'ouvre sur place, sans
 * quitter la fiche — demande client).
 */

// ── Calculateurs ─────────────────────────────────────────────────────────────

function LigneComparaison({ concurrent, label }: { concurrent: number; label: string }) {
  const opatamM = OPATAM_PRIX.soloMensuel;
  const studioM = OPATAM_PRIX.studioMensuel;
  if (concurrent <= 0) return null;
  const ecoSolo = (concurrent - opatamM) * 12;
  const ecoStudio = (concurrent - studioM) * 12;
  return (
    <div className="mt-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 px-4 py-3 text-sm space-y-1">
      <p className="text-gray-700 dark:text-gray-300">
        {label} : <strong className="tabular-nums">{euros(concurrent)} €/mois</strong>
      </p>
      <p className="text-gray-600 dark:text-gray-400 text-xs">
        Opatam Pro {euros(opatamM)} €/mois →{' '}
        <span className={ecoSolo > 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-red-600'}>
          {ecoSolo > 0 ? `${euros(ecoSolo)} € économisés/an` : `${euros(-ecoSolo)} € de plus/an`}
        </span>
        {' · '}Studio {euros(studioM)} €/mois →{' '}
        <span className={ecoStudio > 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-red-600'}>
          {ecoStudio > 0 ? `${euros(ecoStudio)} € économisés/an` : `${euros(-ecoStudio)} € de plus/an`}
        </span>
      </p>
    </div>
  );
}

const CHAMP =
  'w-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white tabular-nums';

function CalculateurDevis() {
  const [devis, setDevis] = useState('');
  const montant = parseFloat(devis.replace(',', '.')) || 0;
  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        Montant du devis du prospect
        <input value={devis} onChange={(e) => setDevis(e.target.value)} placeholder="99" className={CHAMP} />
        €/mois
      </label>
      <LigneComparaison concurrent={montant} label="Devis concurrent" />
    </div>
  );
}

function CalculateurTreatwell() {
  const [ticket, setTicket] = useState('45');
  const [nouveaux, setNouveaux] = useState('6');
  const commission = (parseFloat(ticket.replace(',', '.')) || 0) * (parseInt(nouveaux, 10) || 0) * 0.25;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
        <label className="flex items-center gap-2">
          Ticket moyen
          <input value={ticket} onChange={(e) => setTicket(e.target.value)} className={CHAMP} /> €
        </label>
        <label className="flex items-center gap-2">
          Nouveaux clients marketplace / mois
          <input value={nouveaux} onChange={(e) => setNouveaux(e.target.value)} className={CHAMP} />
        </label>
      </div>
      <p className="text-xs text-gray-400">Commission de 25 % sur la première réservation de chaque nouveau client marketplace (+ 2 % + TVA sur les prépaiements, non comptés ici).</p>
      <LigneComparaison concurrent={commission} label="Commission d’apport estimée" />
    </div>
  );
}

function CalculateurFresha() {
  const [membres, setMembres] = useState('3');
  const [fidelite, setFidelite] = useState(false);
  const [donnees, setDonnees] = useState(false);
  const n = Math.max(1, parseInt(membres, 10) || 1);
  // Grille Fresha : plan indépendant 14,95 €/mois pour UNE personne ;
  // au-delà, 9,95 € par membre réservable.
  const base = n === 1 ? 14.95 : n * 9.95;
  const total = base + (fidelite ? 59.95 : 0) + (donnees ? n * 9.95 : 0);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
        <label className="flex items-center gap-2">
          Membres réservables
          <input value={membres} onChange={(e) => setMembres(e.target.value)} className={CHAMP} />
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={fidelite} onChange={(e) => setFidelite(e.target.checked)} className="rounded" />
          Fidélité (59,95 €/mois)
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={donnees} onChange={(e) => setDonnees(e.target.checked)} className="rounded" />
          Module données (9,95 €/membre)
        </label>
      </div>
      <p className="text-xs text-gray-400">Base : 9,95 € par membre réservable (14,95 €/mois pour un indépendant seul, sans module). SMS/WhatsApp/e-mails marketing facturés à l’usage au-delà du quota, non comptés ici.</p>
      <LigneComparaison concurrent={total} label={`Fresha estimé (${n} membre${n > 1 ? 's' : ''})`} />
    </div>
  );
}

function CalculateurBooksy() {
  const [collab, setCollab] = useState('2');
  const n = Math.max(1, parseInt(collab, 10) || 1);
  const ht = 59 + Math.max(0, n - 1) * 10;
  const ttc = ht * 1.2;
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        Collaborateurs
        <input value={collab} onChange={(e) => setCollab(e.target.value)} className={CHAMP} />
      </label>
      <p className="text-xs text-gray-400">
        Booksy : 59 € HT/mois + 10 € HT par utilisateur supplémentaire → {euros(ht)} € HT ≈ {euros(ttc)} € TTC.
      </p>
      <LigneComparaison concurrent={ttc} label="Booksy estimé (TTC)" />
    </div>
  );
}

// ── La carte ─────────────────────────────────────────────────────────────────

function Bloc({
  icone: Icone,
  titre,
  ton,
  children,
}: {
  icone: React.ComponentType<{ className?: string }>;
  titre: string;
  ton?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <p
        className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 ${
          ton ?? 'text-gray-500 dark:text-gray-400'
        }`}
      >
        <Icone className="w-3.5 h-3.5" /> {titre}
      </p>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function CarteDetail({ carte }: { carte: Battlecard }) {
  const [phraseCopiee, setPhraseCopiee] = useState<string | null>(null);
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Opatam face à {carte.nom}</h2>
          <span className="text-[10px] text-gray-400">
            vérifié le {new Date(carte.verifieLe).toLocaleDateString('fr-FR')}
            {Date.now() - new Date(carte.verifieLe).getTime() > 90 * 86_400_000 && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 font-semibold">
                À revérifier
              </span>
            )}
          </span>
        </div>
        {carte.badge && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 rounded-full px-3 py-1">
            <AlertTriangle className="w-3.5 h-3.5" /> {carte.badge}
          </p>
        )}
        {/* L'argument principal — lisible en cinq secondes */}
        <p className="mt-3 text-[15px] font-medium text-gray-900 dark:text-white leading-relaxed bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-xl px-4 py-3">
          {carte.argumentPrincipal}
        </p>
      </div>

      <div className="px-6 py-5 grid lg:grid-cols-2 gap-x-8 gap-y-6">
        <Bloc icone={Shield} titre={`Les forces de ${carte.nom} — à reconnaître`}>
          <ul className="space-y-1.5">
            {carte.forces.map((f) => (
              <li key={f} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-gray-400 mt-2 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </Bloc>

        <Bloc icone={BadgeCheck} titre="Les avantages Opatam vérifiés" ton="text-emerald-600 dark:text-emerald-400">
          <ul className="space-y-1.5">
            {carte.avantages.map((a) => (
              <li key={a} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </Bloc>

        {carte.questions.length > 0 && (
          <Bloc icone={HelpCircle} titre="À poser avant d'argumenter">
            <ul className="space-y-1.5">
              {carte.questions.map((q) => (
                <li key={q} className="text-sm text-gray-600 dark:text-gray-300 italic">« {q} »</li>
              ))}
            </ul>
          </Bloc>
        )}

        <Bloc icone={Quote} titre="Phrases prêtes à prononcer">
          <ul className="space-y-2">
            {carte.phrases.map((p) => (
              <li
                key={p}
                className="group text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800/60 rounded-xl px-3.5 py-2.5 leading-relaxed flex items-start gap-2"
              >
                <span className="flex-1">« {p} »</span>
                <button
                  onClick={() => {
                    void navigator.clipboard?.writeText(p);
                    setPhraseCopiee(p);
                    setTimeout(() => setPhraseCopiee((prev) => (prev === p ? null : prev)), 1500);
                  }}
                  className="flex-shrink-0 p-1 rounded-md text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  title="Copier la phrase"
                  aria-label="Copier la phrase"
                >
                  {phraseCopiee === p ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Clipboard className="w-3.5 h-3.5" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Bloc>

        {carte.objections.length > 0 && (
          <Bloc icone={MessageCircle} titre="Objections fréquentes">
            <ul className="space-y-2.5">
              {carte.objections.map((o) => (
                <li key={o.objection} className="text-sm">
                  <p className="font-medium text-gray-900 dark:text-white">{o.objection}</p>
                  <p className="text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">{o.reponse}</p>
                </li>
              ))}
            </ul>
          </Bloc>
        )}

        {carte.aNePasDire.length > 0 && (
          <Bloc icone={Ban} titre="À ne surtout pas dire" ton="text-red-600 dark:text-red-400">
            <ul className="space-y-1.5">
              {carte.aNePasDire.map((n) => (
                <li key={n} className="text-sm text-red-700 dark:text-red-300 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                  <Ban className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  {n}
                </li>
              ))}
            </ul>
          </Bloc>
        )}
      </div>

      {carte.calculateur && (
        <div className="px-6 py-5 border-t border-gray-100 dark:border-gray-800">
          <Bloc icone={Calculator} titre="Calculateur de coût">
            {carte.calculateur === 'devis' && <CalculateurDevis />}
            {carte.calculateur === 'treatwell' && <CalculateurTreatwell />}
            {carte.calculateur === 'fresha' && <CalculateurFresha />}
            {carte.calculateur === 'booksy' && <CalculateurBooksy />}
          </Bloc>
        </div>
      )}

      {carte.sources.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-x-5 gap-y-1">
          {carte.sources.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:underline inline-flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" /> {s.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
