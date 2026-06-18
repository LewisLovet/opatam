'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { Button, Input, Logo } from '@/components/ui';
import { confirmResetPassword, applyAuthActionCode, signOutUser } from '@booking-app/firebase';

function ResetPasswordForm({ oobCode, nextPath }: { oobCode: string; nextPath: string }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      await confirmResetPassword(oobCode, newPassword);
      setSuccess(true);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/expired-action-code') {
        setError('Ce lien a expiré. Veuillez refaire une demande de réinitialisation.');
      } else if (code === 'auth/invalid-action-code') {
        setError('Ce lien est invalide ou a déjà été utilisé.');
      } else if (code === 'auth/weak-password') {
        setError('Le mot de passe est trop faible (6 caractères minimum).');
      } else {
        setError(err.message || 'Une erreur est survenue');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Mot de passe modifié !
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.
        </p>
        <Link
          href={nextPath}
          className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="w-14 h-14 mb-4 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <Lock className="w-7 h-7 text-primary-600 dark:text-primary-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Nouveau mot de passe
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Choisissez un nouveau mot de passe pour votre compte
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            label="Nouveau mot de passe"
            placeholder="6 caractères minimum"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <Input
          type={showPassword ? 'text' : 'password'}
          label="Confirmer le mot de passe"
          placeholder="Retapez le nouveau mot de passe"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
        />

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={loading}
          disabled={!newPassword || !confirmPassword}
        >
          Réinitialiser
        </Button>
      </form>
    </div>
  );
}

/**
 * Handles email action links that just need the oobCode applied:
 *   - verifyAndChangeEmail  (confirming an email change via verifyBeforeUpdateEmail)
 *   - verifyEmail           (confirming a new account's email)
 *   - recoverEmail          (undoing an email change)
 */
function EmailActionHandler({ oobCode, mode }: { oobCode: string; mode: string }) {
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    applyAuthActionCode(oobCode)
      .then(async () => {
        // A login-email change (or its undo) invalidates the current
        // session and any cached email — force a clean re-login to avoid a
        // stale/desynced session. (verifyEmail doesn't change the login
        // email, so we keep the session there.)
        if (mode === 'verifyAndChangeEmail' || mode === 'recoverEmail') {
          try {
            await signOutUser();
          } catch {
            /* no session to clear — fine */
          }
        }
        if (!cancelled) setState('success');
      })
      .catch((err: any) => {
        if (cancelled) return;
        const code = err?.code || '';
        if (code === 'auth/expired-action-code') {
          setError('Ce lien a expiré. Relancez le changement depuis vos paramètres.');
        } else if (code === 'auth/invalid-action-code') {
          setError('Ce lien est invalide ou a déjà été utilisé.');
        } else {
          setError(err?.message || 'Une erreur est survenue.');
        }
        setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [oobCode, mode]);

  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Vérification en cours…</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Lien invalide</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">{error}</p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  const isChange = mode === 'verifyAndChangeEmail' || mode === 'recoverEmail';
  return (
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {isChange ? 'Adresse email confirmée !' : 'Email vérifié !'}
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        {isChange
          ? 'Votre nouvelle adresse email est désormais active. Reconnectez-vous avec cette adresse.'
          : 'Votre adresse email a bien été vérifiée.'}
      </p>
      <Link
        href="/login"
        className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors"
      >
        Se connecter
      </Link>
    </div>
  );
}

function InvalidLink() {
  return (
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Lien invalide
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Ce lien de réinitialisation est invalide ou a expiré.
      </p>
      <Link
        href="/forgot-password"
        className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors"
      >
        Demander un nouveau lien
      </Link>
    </div>
  );
}

function ActionContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');

  if (!oobCode) {
    return <InvalidLink />;
  }

  if (mode === 'resetPassword') {
    // After a reset, send the user back to the right login. `next` is honored
    // only when it's a safe relative path (defends against open-redirect);
    // defaults to the PRO /login so the existing flow is unchanged.
    const rawNext = searchParams.get('next');
    const nextPath =
      rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
        ? rawNext
        : '/login';
    return <ResetPasswordForm oobCode={oobCode} nextPath={nextPath} />;
  }

  // Email confirmation links (change / verify / recover) just apply the code.
  if (
    mode === 'verifyAndChangeEmail' ||
    mode === 'verifyEmail' ||
    mode === 'recoverEmail'
  ) {
    return <EmailActionHandler oobCode={oobCode} mode={mode} />;
  }

  return <InvalidLink />;
}

export default function AuthActionPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/">
            <Logo size="lg" />
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <ActionContent />
          </Suspense>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          &copy; {new Date().getFullYear()} Opatam. Tous droits réservés.
        </p>
      </div>
    </div>
  );
}
