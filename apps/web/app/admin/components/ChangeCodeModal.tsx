'use client';

import { useState, useCallback } from 'react';
import { X, Eye, EyeOff, Loader2, KeyRound, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ChangeCodeModalProps {
  open: boolean;
  onClose: () => void;
}

export function ChangeCodeModal({ open, onClose }: ChangeCodeModalProps) {
  const { user } = useAuth();
  const [currentCode, setCurrentCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const reset = () => {
    setCurrentCode('');
    setNewCode('');
    setConfirmCode('');
    setError('');
    setSaving(false);
    setSuccess(false);
    setShowCurrent(false);
    setShowNew(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = useCallback(async () => {
    if (!user) return;

    if (!currentCode.trim()) {
      setError('Entrez votre code actuel');
      return;
    }
    if (newCode.trim().length < 4) {
      setError('Le nouveau code doit faire au moins 4 caractères');
      return;
    }
    if (newCode.trim() !== confirmCode.trim()) {
      setError('Les nouveaux codes ne correspondent pas');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/admin/change-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          currentCode: currentCode.trim(),
          newCode: newCode.trim(),
        }),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => handleClose(), 1500);
      } else {
        const data = await response.json();
        setError(data.error || 'Erreur lors du changement');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setSaving(false);
    }
  }, [user, currentCode, newCode, confirmCode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') handleClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={handleClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Modifier le code
              </h3>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {success ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                <Check className="w-7 h-7 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-emerald-600">Code modifié avec succès</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Current code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Code actuel
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentCode}
                    onChange={(e) => { setCurrentCode(e.target.value); setError(''); }}
                    onKeyDown={handleKeyDown}
                    placeholder="Votre code actuel"
                    className="w-full px-4 py-2.5 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                    autoFocus
                    disabled={saving}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Nouveau code
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newCode}
                    onChange={(e) => { setNewCode(e.target.value); setError(''); }}
                    onKeyDown={handleKeyDown}
                    placeholder="Min. 4 caractères"
                    className="w-full px-4 py-2.5 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                    disabled={saving}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm new code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Confirmer le nouveau code
                </label>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={confirmCode}
                  onChange={(e) => { setConfirmCode(e.target.value); setError(''); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Répéter le nouveau code"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                  disabled={saving}
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleClose}
                  disabled={saving}
                  className="flex-1 py-2.5 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving || !currentCode.trim() || !newCode.trim() || !confirmCode.trim()}
                  className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    'Enregistrer'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
