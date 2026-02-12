'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Button, Input, Checkbox } from '@/components/ui';
import { authService } from '@booking-app/firebase';

// Map Firebase errors to user-friendly messages
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    switch (code) {
      case 'auth/invalid-email':
        return 'Adresse email invalide';
      case 'auth/user-disabled':
        return 'Ce compte a été désactivé';
      case 'auth/user-not-found':
        return 'Aucun compte trouvé avec cet email';
      case 'auth/wrong-password':
        return 'Mot de passe incorrect';
      case 'auth/invalid-credential':
        return 'Email ou mot de passe incorrect';
      case 'auth/too-many-requests':
        return 'Trop de tentatives. Veuillez réessayer plus tard';
      default:
        return error.message || 'Une erreur est survenue';
    }
  }
  return 'Une erreur est survenue';
}

// Inner component that uses useSearchParams
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Check for registration success message
  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setSuccessMessage('Compte créé avec succès ! Connectez-vous pour continuer.');
      // Clean URL without reloading
      window.history.replaceState({}, '', '/login');
    }
  }, [searchParams]);

  const validateForm = (): boolean => {
    if (!email.trim()) {
      setError('Veuillez entrer votre adresse email');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Adresse email invalide');
      return false;
    }
    if (!password) {
      setError('Veuillez entrer votre mot de passe');
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
      const { user } = await authService.login({ email, password });

      // Redirect based on user role
      if (user.role === 'client') {
        // Clients should use the mobile app
        router.push('/telechargement');
      } else if (user.providerId) {
        // Provider with completed setup
        router.push('/pro');
      } else {
        // Provider without setup
        router.push('/pro/onboarding');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Bon retour parmi nous !
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Connectez-vous pour accéder à votre espace
        </p>
      </div>

      {/* Success message (after registration) */}
      {successMessage && (
        <div className="mb-6 p-4 rounded-lg bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400 flex-shrink-0" />
          <p className="text-sm text-success-700 dark:text-success-400">{successMessage}</p>
        </div>
      )}

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

        {/* Password */}
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            label="Mot de passe"
            placeholder="Votre mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="pl-10 pr-10"
          />
          <Lock className="absolute left-3 top-[38px] w-4 h-4 text-gray-400" />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Remember me + Forgot password */}
        <div className="flex items-center justify-between">
          <Checkbox
            label="Se souvenir de moi"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={loading}
          />
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            Mot de passe oublie ?
          </Link>
        </div>

        {/* Submit button */}
        <Button type="submit" fullWidth size="lg" loading={loading}>
          Se connecter
        </Button>
      </form>

      {/* Register link */}
      <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
        Nouveau sur Opatam ?{' '}
        <Link
          href="/register"
          className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
        >
          Creer un compte
        </Link>
      </p>
    </div>
  );
}

// Main component with Suspense boundary (required for useSearchParams in Next.js 15)
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageSkeleton />}>
      <LoginContent />
    </Suspense>
  );
}

// Loading skeleton for Suspense fallback
function LoginPageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-8">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      </div>
      <div className="space-y-5">
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
}
