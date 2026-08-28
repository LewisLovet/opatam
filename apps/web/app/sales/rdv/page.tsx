'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCircle,
  Clipboard,
  Lightbulb,
  Loader2,
  Mail,
  MessageCircle,
  Presentation,
  Quote,
  Tag,
  Wand2,
} from 'lucide-react';
import { BATTLECARDS, OPATAM_PRIX, type Battlecard } from '@/app/sales/bibliotheque/battlecards';
import { enTetesStaff } from '@/app/sales/entetes';

/**
 * Mode rendez-vous — le chaînon « préparer → argumenter → agir » de la
 * bibliothèque. Le commercial répond à six questions (pré-remplies depuis la
 * fiche prospect quand on arrive avec ?lead=), et la FICHE COURTE se
 * construit en direct : la bonne phrase dans les cinq prochaines secondes,
 * pas une encyclopédie à relire.
 *
 * Tout est DÉTERMINISTE : arguments, interdits, questions et réponses aux
 * objections viennent de la battlecard vérifiée — rien n'est inventé en
 * plein rendez-vous. La fin d'entretien collecte trois champs (argument,
 * objection, résultat) vers salesMeetings : on mesure dès maintenant, on
 * n'en tirera des leçons qu'avec du volume.
 */

interface LeadLeger {
  id: string;
  businessName: string;
  contactName: string | null;
  email: string | null;
  city: string | null;
  isTeam: boolean;
  source: string | null;
  mainPain: string | null;
  currentPlatform: string | null;
  currentPriceEuros: number | null;
}

const PROBLEMES_COURANTS = [
  'Rendez-vous manqués (lapins) à répétition',
  'Agenda papier / DM Instagram chronophage',
  'Commissions de la marketplace trop chères',
  'Sa plateforme actuelle coûte trop cher',
  'Pas assez de nouvelles clientes / visibilité',
  'Pas de site ou une image en ligne datée',
  'Acomptes impossibles à encaisser',
] as const;

const SOURCES_CLIENTES = [
  ['instagram', 'Instagram / réseaux'],
  ['google', 'Google / recherche'],
  ['bouche_a_oreille', 'Bouche-à-oreille'],
  ['marketplace', 'La marketplace de sa plateforme'],
  ['autre', 'Autre / ne sait pas'],
] as const;

/** Démo recommandée — la règle par source de clientèle. */
function demoRecommandee(source: string, carte: Battlecard): string {
  if (source === 'instagram') {
    return 'Page publique → réservation invitée (sans compte) → QR code à mettre en bio — le chemin Instagram → agenda rempli.';
  }
  if (source === 'marketplace') {
    return `Sa page à ses couleurs + le widget sur son site : montrer qu'on transforme SA clientèle en réservations, sans dépendre de la vitrine ${carte.nom}.`;
  }
  if (source === 'bouche_a_oreille' || source === 'google') {
    return 'Agenda + rappels automatiques + lien partageable : la clientèle existante réserve seule, les lapins diminuent.';
  }
  return 'Parcours complet : page publique, réservation invitée, agenda pro, rappels.';
}

/** Offre suggérée — trois règles simples, affichées comme suggestion. */
function offreSuggeree(objectionsCochees: string[], prixEuros: number | null): string {
  const objectionPrix = objectionsCochees.some((o) => /prix|cher|coût|cout|budget/i.test(o));
  if (objectionPrix) {
    return '−50 % le premier mois (code 14 jours) — répond directement au frein prix, coût minime sur 12 mois.';
  }
  if (prixEuros !== null && prixEuros > 40) {
    return `Aucune remise nécessaire : à ${prixEuros.toLocaleString('fr-FR')} €/mois aujourd'hui, l'économie EST l'offre. Essai 30 jours sans carte.`;
  }
  return "Essai 30 jours sans carte d'abord — gardez les offres en réserve pour lever une hésitation réelle.";
}

function BoutonCopier({ texte, taille = 'w-3.5 h-3.5' }: { texte: string; taille?: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(texte);
        setCopie(true);
        setTimeout(() => setCopie(false), 1500);
      }}
      className="flex-shrink-0 p-1 rounded-md text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      title="Copier"
      aria-label="Copier"
    >
      {copie ? <Check className={`${taille} text-emerald-500`} /> : <Clipboard className={taille} />}
    </button>
  );
}

export default function ModeRendezVousWrapper() {
  return (
    <Suspense fallback={<Loader2 className="w-5 h-5 animate-spin text-gray-400" />}>
      <ModeRendezVous />
    </Suspense>
  );
}

function ModeRendezVous() {
  const searchParams = useSearchParams();
  const leadId = searchParams.get('lead');

  // ── Le brief (six questions) ──
  const [carteId, setCarteId] = useState<string>(searchParams.get('carte') ?? 'aucun');
  const [problemeChoisi, setProblemeChoisi] = useState('');
  const [problemeLibre, setProblemeLibre] = useState('');
  const probleme = problemeChoisi === 'autre' ? problemeLibre : problemeChoisi;
  const [prix, setPrix] = useState('');
  const [equipe, setEquipe] = useState(false);
  const [sourceClientes, setSourceClientes] = useState('autre');
  const [objectionsCochees, setObjectionsCochees] = useState<Set<string>>(new Set());

  // ── Fin de rendez-vous ──
  const [argumentUtilise, setArgumentUtilise] = useState('');
  const [objectionPrincipale, setObjectionPrincipale] = useState('');
  const [resultat, setResultat] = useState<string>('');
  const [prochaineEtape, setProchaineEtape] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);
  const [enregistre, setEnregistre] = useState(false);

  const [lead, setLead] = useState<LeadLeger | null>(null);

  // Modale d'envoi du récapitulatif — un e-mail simple, pas une redirection
  // opaque vers la page Offres.
  const [envoiOuvert, setEnvoiOuvert] = useState(false);
  const [envoiEmail, setEnvoiEmail] = useState('');
  const [envoiMessage, setEnvoiMessage] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [envoiFait, setEnvoiFait] = useState(false);

  useEffect(() => {
    if (!leadId) return;
    void (async () => {
      const res = await fetch('/api/sales/leads', { headers: await enTetesStaff() });
      if (!res.ok) return;
      const { leads } = await res.json();
      const l = (leads as LeadLeger[]).find((x) => x.id === leadId);
      if (!l) return;
      setLead(l);
      // Pré-remplissage : la fiche prospect est la source, pas une re-saisie.
      if (l.currentPlatform && BATTLECARDS.some((c) => c.id === l.currentPlatform)) {
        setCarteId(l.currentPlatform);
      }
      if (l.mainPain) {
        if ((PROBLEMES_COURANTS as readonly string[]).includes(l.mainPain)) {
          setProblemeChoisi(l.mainPain);
        } else {
          setProblemeChoisi('autre');
          setProblemeLibre(l.mainPain);
        }
      }
      if (l.currentPriceEuros !== null) setPrix(String(l.currentPriceEuros));
      setEquipe(l.isTeam);
      if (l.source && /insta/i.test(l.source)) setSourceClientes('instagram');
    })();
  }, [leadId]);

  const carte = useMemo(
    () => BATTLECARDS.find((c) => c.id === carteId) ?? BATTLECARDS[BATTLECARDS.length - 1],
    [carteId],
  );
  const prixEuros = prix.trim() === '' ? null : Number(prix.replace(',', '.'));
  const prixValide = prixEuros !== null && Number.isFinite(prixEuros) && prixEuros > 0;

  // ── La fiche courte, dérivée en direct ──
  const opatamMensuel = equipe ? OPATAM_PRIX.studioMensuel ?? 29.9 : OPATAM_PRIX.soloMensuel;
  const economieAnnuelle = prixValide ? Math.round((prixEuros! - opatamMensuel) * 12) : null;
  const argumentsRetenus = useMemo(() => {
    const liste = [carte.argumentPrincipal, ...carte.avantages];
    if (sourceClientes === 'instagram') {
      liste.splice(1, 0, 'Vos clientes réservent depuis votre lien Instagram sans créer de compte ni télécharger d’application.');
    }
    return [...new Set(liste)].slice(0, 3);
  }, [carte, sourceClientes]);
  const objectionsAvecReponse = carte.objections.filter((o) => objectionsCochees.has(o.objection));

  const recap = useMemo(() => {
    const nom = lead?.businessName ?? 'le prospect';
    const lignes = [
      `Récapitulatif de notre échange — ${nom}`,
      '',
      `Situation actuelle : ${carte.nom}${prixValide ? ` (~${prixEuros!.toLocaleString('fr-FR')} €/mois selon votre devis)` : ''}${equipe ? ', en équipe' : ', en solo'}.`,
      probleme.trim() ? `Votre priorité : ${probleme.trim()}.` : null,
      '',
      'Ce qu’Opatam vous apporte :',
      ...argumentsRetenus.map((a) => `• ${a}`),
      prixValide && economieAnnuelle !== null && economieAnnuelle > 0
        ? `• Budget : ${opatamMensuel.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € TTC/mois au lieu de ~${prixEuros!.toLocaleString('fr-FR')} € — environ ${economieAnnuelle.toLocaleString('fr-FR')} € économisés par an.`
        : null,
      '',
      `Prochaine étape : ${prochaineEtape.trim() || 'essai gratuit de 30 jours, sans carte bancaire — je vous accompagne pour la mise en route.'}`,
    ].filter((l): l is string => l !== null);
    return lignes.join('\n');
  }, [lead, carte, prixValide, prixEuros, equipe, probleme, argumentsRetenus, economieAnnuelle, opatamMensuel, prochaineEtape]);

  const ouvrirEnvoi = () => {
    setEnvoiEmail(lead?.email ?? '');
    setEnvoiMessage(recap);
    setEnvoiFait(false);
    setEnvoiOuvert(true);
  };

  const envoyerRecap = async () => {
    setEnvoiEnCours(true);
    try {
      // Circuit invitation existant : e-mail attribué + tracé, le récap en
      // message personnel, le lien d'inscription part avec.
      const res = await fetch('/api/sales/invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await enTetesStaff()) },
        body: JSON.stringify({
          email: envoiEmail.trim(),
          message: envoiMessage.slice(0, 1200),
          leadId: lead?.id ?? undefined,
        }),
      });
      if (!res.ok) {
        alert((await res.json()).error ?? 'Envoi impossible');
        return;
      }
      setEnvoiFait(true);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const enregistrer = async () => {
    setEnregistrement(true);
    try {
      const res = await fetch('/api/sales/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await enTetesStaff()) },
        body: JSON.stringify({
          leadId: lead?.id ?? null,
          competitor: carte.nom,
          reponses: {
            probleme: probleme.trim(),
            prixEuros: prixValide ? prixEuros : null,
            equipe,
            sourceClientes,
            objectionsCochees: [...objectionsCochees],
          },
          argumentUtilise,
          objectionPrincipale,
          resultat: resultat || null,
          prochaineEtape: prochaineEtape.trim(),
          // La fiche prospect absorbe ce qu'on a appris — écrit dans la MÊME
          // transaction serveur que le compte rendu (pas d'échec silencieux).
          ...(lead
            ? {
                leadPatch: {
                  mainPain: probleme.trim() || null,
                  currentPlatform: BATTLECARDS.some((c) => c.id === carteId)
                    ? carteId
                    : lead.currentPlatform,
                  currentPriceEuros: prixValide ? prixEuros : null,
                  isTeam: equipe,
                },
              }
            : {}),
        }),
      });
      if (!res.ok) {
        alert((await res.json()).error ?? 'Enregistrement impossible');
        return;
      }
      setEnregistre(true);
    } finally {
      setEnregistrement(false);
    }
  };

  const CHAMP =
    'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={lead ? `/sales/pipeline?lead=${lead.id}` : '/sales/bibliotheque'}
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {lead ? 'Retour à la fiche' : 'Retour à la bibliothèque'}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            Mode rendez-vous{lead ? ` — ${lead.businessName}` : ''}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Six questions, et la fiche courte se construit — la bonne phrase dans les cinq
            prochaines secondes.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-5 items-start">
        {/* ── Le brief ── */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3.5 lg:sticky lg:top-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Le brief</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Qu&apos;utilise-t-il aujourd&apos;hui ?
            </label>
            <select value={carteId} onChange={(e) => setCarteId(e.target.value)} className={CHAMP}>
              {BATTLECARDS.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Son problème principal
            </label>
            <select
              value={problemeChoisi}
              onChange={(e) => setProblemeChoisi(e.target.value)}
              className={CHAMP}
            >
              <option value="">—</option>
              {PROBLEMES_COURANTS.map((pb) => (
                <option key={pb} value={pb}>{pb}</option>
              ))}
              <option value="autre">Autre…</option>
            </select>
            {problemeChoisi === 'autre' && (
              <input
                value={problemeLibre}
                onChange={(e) => setProblemeLibre(e.target.value.slice(0, 200))}
                placeholder="Décrivez son problème…"
                className={`${CHAMP} mt-1.5`}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Prix actuel (€/mois)
              </label>
              <input
                value={prix}
                onChange={(e) => setPrix(e.target.value.replace(/[^\d,.]/g, ''))}
                placeholder="Son devis réel"
                className={CHAMP}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Équipe ?
              </label>
              <select
                value={equipe ? 'oui' : 'non'}
                onChange={(e) => setEquipe(e.target.value === 'oui')}
                className={CHAMP}
              >
                <option value="non">Solo</option>
                <option value="oui">Plusieurs membres</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              D&apos;où viennent ses nouvelles clientes ?
            </label>
            <select value={sourceClientes} onChange={(e) => setSourceClientes(e.target.value)} className={CHAMP}>
              {SOURCES_CLIENTES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          {carte.objections.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                Objections déjà exprimées
              </label>
              <div className="space-y-1.5">
                {carte.objections.map((o) => (
                  <label key={o.objection} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={objectionsCochees.has(o.objection)}
                      onChange={(e) => {
                        setObjectionsCochees((prev) => {
                          const suiv = new Set(prev);
                          if (e.target.checked) suiv.add(o.objection);
                          else suiv.delete(o.objection);
                          return suiv;
                        });
                      }}
                      className="rounded mt-0.5"
                    />
                    {o.objection}
                  </label>
                ))}
              </div>
            </div>
          )}
          <p className="text-[11px] text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-2.5">
            {lead
              ? 'Pré-rempli depuis la fiche — vos réponses y seront réécrites à l’enregistrement.'
              : 'Sans fiche liée : ouvrez ce mode depuis un prospect pour tout pré-remplir.'}
          </p>
        </div>

        {/* ── La fiche courte ── */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Fiche courte — face à {carte.nom}
              </h2>
              <Link
                href={`/sales/bibliotheque?carte=${carte.id}`}
                className="text-[11px] text-gray-400 hover:underline"
              >
                battlecard complète
              </Link>
            </div>

            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 overflow-hidden">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-900">
                <Lightbulb className="w-3.5 h-3.5" /> Les trois arguments
              </p>
              <div className="p-3.5">
              <ul className="space-y-1.5">
                {argumentsRetenus.map((a) => (
                  <li key={a} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="flex-1">{a}</span>
                    <BoutonCopier texte={a} />
                  </li>
                ))}
                {prixValide && economieAnnuelle !== null && economieAnnuelle > 0 && (
                  <li className="flex items-start gap-2 text-sm font-medium text-gray-900 dark:text-white bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-2.5 py-2">
                    <span className="flex-1">
                      Son devis : {prixEuros!.toLocaleString('fr-FR')} €/mois. Opatam :{' '}
                      {opatamMensuel.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € TTC →
                      ~{economieAnnuelle.toLocaleString('fr-FR')} € d&apos;économie par an.
                    </span>
                    <BoutonCopier
                      texte={`Votre devis actuel : ${prixEuros!.toLocaleString('fr-FR')} €/mois. Opatam : ${opatamMensuel.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € TTC/mois — environ ${economieAnnuelle.toLocaleString('fr-FR')} € d'économie par an.`}
                    />
                  </li>
                )}
              </ul>
              </div>
            </div>

            {carte.aNePasDire.length > 0 && (
              <div className="rounded-xl border border-red-200 dark:border-red-900 overflow-hidden">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 px-3.5 py-2 bg-red-50 dark:bg-red-900/15 border-b border-red-100 dark:border-red-900">
                  <Ban className="w-3.5 h-3.5" /> À ne pas dire
                </p>
                <ul className="space-y-1 p-3.5">
                  {carte.aNePasDire.slice(0, 3).map((a) => (
                    <li key={a} className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
                      <span className="text-red-400 flex-shrink-0">✕</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-3.5 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                  <MessageCircle className="w-3.5 h-3.5" /> Deux questions à poser
                </p>
                <ul className="space-y-1.5 p-3.5">
                  {carte.questions.slice(0, 2).map((q) => (
                    <li key={q} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <span className="flex-1">{q}</span>
                      <BoutonCopier texte={q} taille="w-3 h-3" />
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-3.5 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                  <Presentation className="w-3.5 h-3.5" /> Démo &amp; offre recommandées
                </p>
                <div className="p-3.5 space-y-2.5">
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    <strong className="text-gray-800 dark:text-gray-100">Démo :</strong>{' '}
                    {demoRecommandee(sourceClientes, carte)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    <strong className="text-gray-800 dark:text-gray-100">Offre :</strong>{' '}
                    {offreSuggeree([...objectionsCochees], prixValide ? prixEuros : null)}
                  </p>
                </div>
              </div>
            </div>

            {objectionsAvecReponse.length > 0 && (
              <div className="rounded-xl border border-blue-200 dark:border-blue-900 overflow-hidden">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 px-3.5 py-2 bg-blue-50 dark:bg-blue-900/15 border-b border-blue-100 dark:border-blue-900">
                  <Quote className="w-3.5 h-3.5" /> Réponses aux objections exprimées
                </p>
                <ul className="space-y-2 p-3.5">
                  {objectionsAvecReponse.map((o) => (
                    <li key={o.objection} className="text-sm bg-blue-50/60 dark:bg-blue-900/20 rounded-xl px-3 py-2.5">
                      <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">{o.objection}</p>
                      <div className="flex items-start gap-2">
                        <p className="flex-1 text-sm text-gray-700 dark:text-gray-200 leading-relaxed">« {o.reponse} »</p>
                        <BoutonCopier texte={o.reponse} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ── Récapitulatif ── */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Récapitulatif à envoyer
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => void navigator.clipboard?.writeText(recap)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:border-gray-400"
                >
                  <Clipboard className="w-3.5 h-3.5" /> Copier
                </button>
                <button
                  onClick={ouvrirEnvoi}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold hover:opacity-90"
                >
                  <Mail className="w-3.5 h-3.5" /> Envoyer par e-mail
                </button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 rounded-xl px-3.5 py-3 leading-relaxed font-sans">
              {recap}
            </pre>
            <p className="text-[11px] text-gray-400">
              L&apos;e-mail part avec ce récapitulatif et votre lien d&apos;inscription attribué —
              la valeur démontrée ne doit pas s&apos;évaporer après l&apos;appel.
            </p>
          </div>

          {/* ── Fin du rendez-vous ── */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Fin du rendez-vous</h2>
            {enregistre ? (
              <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-4 h-4" /> Enregistré
                {lead ? ' — la fiche prospect est à jour et le rendez-vous est au journal.' : '.'}
              </p>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                      L&apos;argument qui a le mieux porté
                    </label>
                    <select value={argumentUtilise} onChange={(e) => setArgumentUtilise(e.target.value)} className={CHAMP}>
                      <option value="">—</option>
                      {argumentsRetenus.map((a) => (
                        <option key={a} value={a}>{a.slice(0, 80)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                      L&apos;objection principale rencontrée
                    </label>
                    <select value={objectionPrincipale} onChange={(e) => setObjectionPrincipale(e.target.value)} className={CHAMP}>
                      <option value="">—</option>
                      {carte.objections.map((o) => (
                        <option key={o.objection} value={o.objection}>{o.objection.slice(0, 80)}</option>
                      ))}
                      <option value="autre">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Résultat</label>
                    <select value={resultat} onChange={(e) => setResultat(e.target.value)} className={CHAMP}>
                      <option value="">—</option>
                      <option value="tres_interesse">Très intéressé</option>
                      <option value="a_relancer">À relancer</option>
                      <option value="hesitant">Hésitant</option>
                      <option value="refus">Refus</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                      Prochaine étape convenue
                    </label>
                    <input
                      value={prochaineEtape}
                      onChange={(e) => setProchaineEtape(e.target.value.slice(0, 300))}
                      placeholder="Ex. démo jeudi 15h, essai lancé…"
                      className={CHAMP}
                    />
                  </div>
                </div>
                <button
                  onClick={() => void enregistrer()}
                  disabled={enregistrement}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {enregistrement ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  Enregistrer le rendez-vous
                </button>
                <p className="text-[11px] text-gray-400">
                  Trente secondes qui nourrissent la fiche prospect et, avec le volume, diront
                  quels arguments convertissent vraiment.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modale d'envoi du récapitulatif */}
      {envoiOuvert && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !envoiEnCours && setEnvoiOuvert(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Envoyer le récapitulatif
            </h2>
            {envoiFait ? (
              <>
                <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-4 h-4" /> Envoyé à {envoiEmail} — avec votre lien
                  d&apos;inscription attribué.
                </p>
                <div className="text-right">
                  <button
                    onClick={() => setEnvoiOuvert(false)}
                    className="px-3.5 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold hover:opacity-90"
                  >
                    Fermer
                  </button>
                </div>
              </>
            ) : (
              <>
                <input
                  type="email"
                  value={envoiEmail}
                  onChange={(e) => setEnvoiEmail(e.target.value)}
                  placeholder="E-mail du prospect"
                  className={CHAMP}
                />
                <textarea
                  value={envoiMessage}
                  onChange={(e) => setEnvoiMessage(e.target.value.slice(0, 1200))}
                  rows={9}
                  className={`${CHAMP} font-mono text-xs leading-relaxed`}
                />
                <p className="text-[11px] text-gray-400">
                  Le message part en tête de l&apos;e-mail d&apos;invitation (1200 caractères max),
                  suivi de l&apos;essai gratuit et de votre lien attribué.
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEnvoiOuvert(false)}
                    disabled={envoiEnCours}
                    className="px-3 py-2 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => void envoyerRecap()}
                    disabled={envoiEnCours || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(envoiEmail.trim())}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                  >
                    {envoiEnCours ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                    Envoyer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
