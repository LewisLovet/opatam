'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { authService } from '@booking-app/firebase';

// Map Firebase errors to user-friendly messages
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    switch (code) {
      case 'auth/invalid-email':
        return 'Adresse email invalide';
      case 'auth/user-not-found':
        return 'Aucun compte trouve avec cet email';
      case 'auth/too-many-requests':
        return 'Trop de tentatives. Veuillez reessayer plus tard';
      default:
        return error.message || 'Une erreur est survenue';
    }
  }
  return 'Une erreur est survenue';
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validateForm = (): boolean => {
    if (!email.trim()) {
      setError('Veuillez entrer votre adresse email');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Adresse email invalide');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      await authService.resetPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-success-600 dark:text-success-400" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Email envoye !
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Verifiez votre boite de reception. Un lien de reinitialisation a ete envoye a{' '}
          <span className="font-medium text-gray-900 dark:text-white">{email}</span>
        </p>

        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Vous n'avez pas recu l'email ? Verifiez vos spams ou{' '}
            <button
              onClick={() => setSuccess(false)}
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
            >
              reessayez
            </button>
          </p>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour a la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Mot de passe oublie ?
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Entrez votre email, nous vous enverrons un lien de reinitialisation
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
          <p className="text-sm text-error-700 dark:text-error-400">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div className="relative">
          <Input
            type="email"
            label="Adresse email"
            placeholder="vous@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="pl-10"
          />
          <Mail className="absolute left-3 top-[38px] w-4 h-4 text-gray-400" />
        </div>

        {/* Submit button */}
        <Button type="submit" fullWidth size="lg" loading={loading}>
          Envoyer le lien
        </Button>
      </form>

      {/* Back to login */}
      <div className="mt-8 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour a la connexion
        </Link>
      </div>
    </div>
  );
}
