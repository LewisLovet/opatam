'use client';

import { useState } from 'react';
import { KeyRound, Loader2, AlertCircle } from 'lucide-react';

interface PlanningLoginProps {
  onAuthenticated: (data: {
    memberId: string;
    providerId: string;
    memberName: string;
    accessCode: string;
  }) => void;
}

export function PlanningLogin({ onAuthenticated }: PlanningLoginProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("Veuillez entrer votre code d'accès");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/planning/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Code d'accès invalide");
        return;
      }

      onAuthenticated(data);
    } catch {
      setError('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 mb-4">
            <KeyRound className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Mon planning
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Entrez votre code d&apos;accès pour consulter votre agenda
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="access-code"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >
              Code d&apos;accès
            </label>
            <input
              id="access-code"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="Ex: MARIE-ABC2"
              autoComplete="off"
              autoFocus
              disabled={loading}
              className={`
                w-full px-4 py-3 rounded-xl border text-center text-lg font-mono font-semibold tracking-wider
                text-gray-900 dark:text-gray-100
                bg-white dark:bg-gray-800
                placeholder:text-gray-300 dark:placeholder:text-gray-600
                placeholder:font-normal placeholder:tracking-normal placeholder:text-base
                transition-colors duration-200
                focus:outline-none focus:ring-2 focus:ring-offset-0
                disabled:opacity-50 disabled:cursor-not-allowed
                ${error
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500'
                }
              `}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className={`
              w-full py-3 px-4 rounded-xl font-semibold text-white
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
              disabled:opacity-50 disabled:cursor-not-allowed
              bg-primary-600 hover:bg-primary-700 active:bg-primary-800
            `}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Vérification...
              </span>
            ) : (
              'Accéder à mon planning'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          Ce code vous a été communiqué par votre employeur.
          <br />
          En cas de problème, contactez-le directement.
        </p>
      </div>
    </div>
  );
}
