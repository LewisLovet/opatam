'use client';

/**
 * /rejoindre?t=… — le membre invité crée son accès à l'espace membre.
 *
 * Le lien vient de l'e-mail d'invitation (jeton signé, 7 jours). Ici, le
 * membre crée son mot de passe — ou se connecte s'il a déjà un compte
 * Opatam avec cette adresse — puis l'invitation est acceptée côté serveur,
 * qui relie son compte à sa fiche. Il se connecte ensuite dans l'app.
 *
 * L'adresse est imposée : c'est celle que le salon a invitée. Un compte
 * ouvert avec une autre adresse ne peut pas accepter.
 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, Smartphone } from 'lucide-react';
import {
  auth,
  createUserWithEmail,
  onAuthChange,
  resetPassword,
  signInWithEmail,
  signOutUser,
} from '@booking-app/firebase';
import { Button, Input } from '@/components/ui';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/store-links';

interface Invitation {
  businessName: string;
  memberName: string;
  email: string;
}

type Etape =
  | { nom: 'chargement' }
  | { nom: 'lien-mort'; message: string }
  | { nom: 'formulaire' }
  | { nom: 'fini' };

/** Messages Firebase Auth, en clair. */
function messageAuth(code: string | undefined): string {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Mot de passe incorrect.';
    case 'auth/weak-password':
      return 'Mot de passe trop faible : 8 caractères minimum.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives : réessayez dans quelques minutes.';
    case 'auth/network-request-failed':
      return 'Connexion impossible : vérifiez votre réseau.';
    default:
      return 'Une erreur est survenue. Réessayez.';
  }
}

export default function RejoindreClient() {
  const jeton = useSearchParams().get('t') ?? '';
  const [etape, setEtape] = useState<Etape>({ nom: 'chargement' });
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [emailConnecte, setEmailConnecte] = useState<string | null | undefined>(undefined);
  const [mode, setMode] = useState<'creer' | 'connecter'>('creer');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  // L'invitation : à qui elle s'adresse, ou pourquoi le lien ne vaut plus.
  useEffect(() => {
    if (!jeton) {
      setEtape({ nom: 'lien-mort', message: "Ce lien d'invitation est incomplet." });
      return;
    }
    fetch(`/api/membres/invitation?t=${encodeURIComponent(jeton)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Ce lien d'invitation n'est pas valide.");
        setInvitation(data as Invitation);
        setEtape({ nom: 'formulaire' });
      })
      .catch((e: Error) => setEtape({ nom: 'lien-mort', message: e.message }));
  }, [jeton]);

  useEffect(() => onAuthChange((u) => setEmailConnecte(u?.email ?? null)), []);

  const accepter = useCallback(async () => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Connectez-vous pour accepter.');
    const r = await fetch('/api/membres/invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ t: jeton }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "L'invitation n'a pas pu être acceptée.");
    // L'accès vit dans l'app : on ne laisse pas une session ouverte ici.
    await signOutUser().catch(() => {});
    setEtape({ nom: 'fini' });
  }, [jeton]);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;
    setErreur(null);
    setInfo(null);
    if (mode === 'creer') {
      if (motDePasse.length < 8) return setErreur('8 caractères minimum.');
      if (motDePasse !== confirmation) return setErreur('Les deux mots de passe ne correspondent pas.');
    }
    setOccupe(true);
    try {
      if (mode === 'creer') {
        try {
          await createUserWithEmail(invitation.email, motDePasse);
        } catch (err) {
          if ((err as { code?: string }).code === 'auth/email-already-in-use') {
            // L'adresse a déjà un compte Opatam (cliente, par exemple) : on
            // le rattache plutôt que d'en créer un second.
            setMode('connecter');
            setMotDePasse('');
            setConfirmation('');
            setInfo('Vous avez déjà un compte Opatam avec cette adresse : entrez son mot de passe.');
            return;
          }
          throw err;
        }
      } else {
        await signInWithEmail(invitation.email, motDePasse);
      }
      await accepter();
    } catch (err) {
      const code = (err as { code?: string }).code;
      setErreur(code ? messageAuth(code) : (err as Error).message);
    } finally {
      setOccupe(false);
    }
  };

  const motDePasseOublie = async () => {
    if (!invitation) return;
    setErreur(null);
    try {
      await resetPassword(invitation.email);
      setInfo(`Un lien pour choisir un nouveau mot de passe a été envoyé à ${invitation.email}.`);
    } catch (err) {
      setErreur(messageAuth((err as { code?: string }).code));
    }
  };

  const prenom = invitation?.memberName.trim().split(/\s+/)[0] ?? '';
  const autreCompte = !!emailConnecte && !!invitation && emailConnecte.toLowerCase() !== invitation.email.toLowerCase();
  const memeCompte = !!emailConnecte && !!invitation && !autreCompte;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {etape.nom === 'chargement' && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
          </div>
        )}

        {etape.nom === 'lien-mort' && (
          <div className="text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
            <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">Lien indisponible</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{etape.message}</p>
          </div>
        )}

        {etape.nom === 'formulaire' && invitation && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Espace membre</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">Rejoindre {invitation.businessName}</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              {prenom ? `Bonjour ${prenom}, c` : 'C'}réez votre accès pour consulter votre agenda, régler vos horaires et
              gérer vos rendez-vous depuis l’application Opatam.
            </p>

            {autreCompte ? (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                Vous êtes connecté avec <strong>{emailConnecte}</strong>, alors que l’invitation est pour{' '}
                <strong>{invitation.email}</strong>.
                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={() => signOutUser()}>
                    Me déconnecter
                  </Button>
                </div>
              </div>
            ) : memeCompte ? (
              <div className="mt-6">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Vous êtes connecté avec <strong>{invitation.email}</strong>.
                </p>
                {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
                <Button
                  className="mt-4"
                  fullWidth
                  loading={occupe}
                  onClick={async () => {
                    setErreur(null);
                    setOccupe(true);
                    try {
                      await accepter();
                    } catch (err) {
                      setErreur((err as Error).message);
                    } finally {
                      setOccupe(false);
                    }
                  }}
                >
                  Rejoindre {invitation.businessName}
                </Button>
              </div>
            ) : (
              <form className="mt-6 space-y-4" onSubmit={soumettre}>
                <Input label="Adresse e-mail" type="email" value={invitation.email} readOnly disabled />
                <Input
                  label={mode === 'creer' ? 'Choisissez un mot de passe' : 'Votre mot de passe'}
                  type="password"
                  autoComplete={mode === 'creer' ? 'new-password' : 'current-password'}
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  required
                />
                {mode === 'creer' && (
                  <Input
                    label="Confirmez le mot de passe"
                    type="password"
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    required
                  />
                )}
                {info && <p className="text-sm text-primary-700 dark:text-primary-300">{info}</p>}
                {erreur && <p className="text-sm text-red-600">{erreur}</p>}
                <Button type="submit" fullWidth loading={occupe}>
                  {mode === 'creer' ? 'Créer mon accès' : 'Me connecter et rejoindre'}
                </Button>
                <div className="flex justify-between text-sm">
                  <button
                    type="button"
                    className="text-gray-500 hover:text-primary-600"
                    onClick={() => {
                      setMode(mode === 'creer' ? 'connecter' : 'creer');
                      setErreur(null);
                      setInfo(null);
                    }}
                  >
                    {mode === 'creer' ? 'J’ai déjà un compte Opatam' : 'Créer un nouveau mot de passe'}
                  </button>
                  {mode === 'connecter' && (
                    <button type="button" className="text-gray-500 hover:text-primary-600" onClick={motDePasseOublie}>
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
              </form>
            )}
          </>
        )}

        {etape.nom === 'fini' && invitation && (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">Votre accès est prêt</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              Téléchargez l’application Opatam et connectez-vous avec <strong>{invitation.email}</strong> et votre mot
              de passe : votre espace {invitation.businessName} vous attend.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href={APP_STORE_URL}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
              >
                <Smartphone className="h-4 w-4" /> App Store
              </a>
              <a
                href={PLAY_STORE_URL}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
              >
                <Smartphone className="h-4 w-4" /> Google Play
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
