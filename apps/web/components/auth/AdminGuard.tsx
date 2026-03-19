'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldCheck, Eye, EyeOff, KeyRound, ArrowRight } from 'lucide-react';

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const { isAuthenticated, isAdmin, loading, user } = useAuth();
  const [isVerified, setIsVerified] = useState(false);
  const [mode, setMode] = useState<'loading' | 'enter' | 'setup'>('loading');
  const [code, setCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [initialCheck, setInitialCheck] = useState(true);

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated || !isAdmin) {
      router.replace('/login');
      return;
    }

    // Check sessionStorage for existing verification
    const sessionVerified = sessionStorage.getItem('adminSessionVerified');
    if (sessionVerified === 'true') {
      setIsVerified(true);
      setInitialCheck(false);
      return;
    }

    // Check if user has a code set
    const checkCodeStatus = async () => {
      try {
        const response = await fetch('/api/admin/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user!.id }),
        });

        if (response.status === 404) {
          const data = await response.json();
          if (data.error === 'NO_CODE_SET') {
            setMode('setup');
          }
        } else {
          setMode('enter');
        }
      } catch {
        setMode('enter');
      }
      setInitialCheck(false);
    };

    checkCodeStatus();
  }, [isAuthenticated, isAdmin, loading, router, user]);

  // Handle code verification (enter mode)
  const handleVerifyCode = useCallback(async () => {
    if (!code.trim() || !user) return;

    setVerifying(true);
    setCodeError('');

    try {
      const response = await fetch('/api/admin/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, code: code.trim() }),
      });

      if (response.ok) {
        sessionStorage.setItem('adminSessionVerified', 'true');
        setIsVerified(true);
      } else {
        const data = await response.json();
        setCodeError(data.error || 'Code incorrect');
      }
    } catch {
      setCodeError('Erreur de connexion');
    } finally {
      setVerifying(false);
    }
  }, [code, user]);

  // Handle first-time code setup
  const handleSetupCode = useCallback(async () => {
    if (!code.trim() || !user) return;

    if (code.trim().length < 4) {
      setCodeError('Le code doit faire au moins 4 caractères');
      return;
    }

    if (code.trim() !== confirmCode.trim()) {
      setCodeError('Les codes ne correspondent pas');
      return;
    }

    setVerifying(true);
    setCodeError('');

    try {
      const response = await fetch('/api/admin/change-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, newCode: code.trim() }),
      });

      if (response.ok) {
        sessionStorage.setItem('adminSessionVerified', 'true');
        setIsVerified(true);
      } else {
        const data = await response.json();
        setCodeError(data.error || 'Erreur lors de la création du code');
      }
    } catch {
      setCodeError('Erreur de connexion');
    } finally {
      setVerifying(false);
    }
  }, [code, confirmCode, user]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (mode === 'setup') {
          handleSetupCode();
        } else {
          handleVerifyCode();
        }
      }
    },
    [mode, handleVerifyCode, handleSetupCode]
  );

  // Loading state
  if (loading || initialCheck) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  // Not authenticated or not admin
  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">Redirection...</p>
        </div>
      </div>
    );
  }

  // Show setup modal (first time — no code set)
  if (mode === 'setup' && !isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <KeyRound className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Créer votre code admin
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center">
              Choisissez un code confidentiel personnel pour sécuriser votre accès admin
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <input
                type={showCode ? 'text' : 'password'}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setCodeError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder="Nouveau code (min. 4 caractères)"
                className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                autoFocus
                disabled={verifying}
              />
              <button
                type="button"
                onClick={() => setShowCode(!showCode)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <input
              type={showCode ? 'text' : 'password'}
              value={confirmCode}
              onChange={(e) => {
                setConfirmCode(e.target.value);
                setCodeError('');
              }}
              onKeyDown={handleKeyDown}
              placeholder="Confirmer le code"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              disabled={verifying}
            />

            {codeError && (
              <p className="text-sm text-red-500 text-center">{codeError}</p>
            )}

            <button
              onClick={handleSetupCode}
              disabled={verifying || !code.trim() || !confirmCode.trim()}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Création...
                </>
              ) : (
                'Créer et accéder'
              )}
            </button>

            <Link
              href="/pro"
              className="w-full py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Aller à l&apos;interface pro
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Show code verification modal (returning admin)
  if (mode === 'enter' && !isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Accès Administration
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center">
              Entrez votre code confidentiel pour accéder au dashboard
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <input
                type={showCode ? 'text' : 'password'}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setCodeError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder="Code confidentiel"
                className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                autoFocus
                disabled={verifying}
              />
              <button
                type="button"
                onClick={() => setShowCode(!showCode)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {codeError && (
              <p className="text-sm text-red-500 text-center">{codeError}</p>
            )}

            <button
              onClick={handleVerifyCode}
              disabled={verifying || !code.trim()}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Vérification...
                </>
              ) : (
                'Accéder'
              )}
            </button>

            <Link
              href="/pro"
              className="w-full py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Aller à l&apos;interface pro
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
