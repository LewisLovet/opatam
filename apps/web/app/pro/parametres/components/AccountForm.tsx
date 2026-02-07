'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Input, Button, Modal } from '@/components/ui';
import {
  updateUserEmail,
  updateUserPassword,
  reauthenticateUser,
  deleteCurrentUser,
  providerService,
  userRepository,
} from '@booking-app/firebase';
import { Loader2, Mail, Lock, AlertTriangle, Info, Trash2, X } from 'lucide-react';

interface AccountFormProps {
  onSuccess?: () => void;
}

export function AccountForm({ onSuccess }: AccountFormProps) {
  const router = useRouter();
  const { user, firebaseUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Email change form
  const [emailForm, setEmailForm] = useState({
    newEmail: '',
    currentPassword: '',
  });

  // Password change form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [activeSection, setActiveSection] = useState<'email' | 'password' | null>(null);

  // Delete account modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteForm, setDeleteForm] = useState({
    confirmText: '',
    password: '',
  });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEmailForm((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleDeleteFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDeleteForm((prev) => ({ ...prev, [name]: value }));
    setDeleteError(null);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firebaseUser) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Reauthenticate user
      await reauthenticateUser(emailForm.currentPassword);

      // Update email
      await updateUserEmail(emailForm.newEmail);

      setSuccess('Adresse email mise à jour avec succès');
      setEmailForm({ newEmail: '', currentPassword: '' });
      setActiveSection(null);
      onSuccess?.();
    } catch (err: unknown) {
      console.error('Email update error:', err);
      const error = err as { code?: string; message?: string };
      if (error.code === 'auth/wrong-password') {
        setError('Mot de passe actuel incorrect');
      } else if (error.code === 'auth/email-already-in-use') {
        setError('Cette adresse email est déjà utilisée');
      } else if (error.code === 'auth/invalid-email') {
        setError('Adresse email invalide');
      } else {
        setError(error.message || 'Une erreur est survenue');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firebaseUser) return;

    // Validate passwords match
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    // Validate password length
    if (passwordForm.newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Reauthenticate user
      await reauthenticateUser(passwordForm.currentPassword);

      // Update password
      await updateUserPassword(passwordForm.newPassword);

      setSuccess('Mot de passe mis à jour avec succès');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setActiveSection(null);
      onSuccess?.();
    } catch (err: unknown) {
      console.error('Password update error:', err);
      const error = err as { code?: string; message?: string };
      if (error.code === 'auth/wrong-password') {
        setError('Mot de passe actuel incorrect');
      } else if (error.code === 'auth/weak-password') {
        setError('Le mot de passe est trop faible');
      } else {
        setError(error.message || 'Une erreur est survenue');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firebaseUser) return;

    // Validate confirmation text
    if (deleteForm.confirmText !== 'SUPPRIMER') {
      setDeleteError('Veuillez taper SUPPRIMER pour confirmer');
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      // Reauthenticate user first
      await reauthenticateUser(deleteForm.password);

      // Delete provider data if exists
      try {
        await providerService.deleteProvider(user.id);
      } catch {
        // Provider might not exist, that's ok
      }

      // Delete user document
      try {
        await userRepository.delete(user.id);
      } catch {
        // User document might not exist, that's ok
      }

      // Delete Firebase Auth account
      await deleteCurrentUser();

      // Redirect to home
      router.push('/');
    } catch (err: unknown) {
      console.error('Delete account error:', err);
      const error = err as { code?: string; message?: string };
      if (error.code === 'auth/wrong-password') {
        setDeleteError('Mot de passe incorrect');
      } else if (error.code === 'auth/requires-recent-login') {
        setDeleteError('Veuillez vous reconnecter avant de supprimer votre compte');
      } else {
        setDeleteError(error.message || 'Une erreur est survenue');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDeleteModal = () => {
    setShowDeleteModal(true);
    setDeleteForm({ confirmText: '', password: '' });
    setDeleteError(null);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteForm({ confirmText: '', password: '' });
    setDeleteError(null);
  };

  return (
    <div className="space-y-6">
      {/* Current Email Display */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Adresse email actuelle
          </span>
        </div>
        <p className="text-gray-900 dark:text-white font-medium">
          {firebaseUser?.email}
        </p>
      </div>

      {/* Email Change Section */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
        <button
          type="button"
          onClick={() => setActiveSection(activeSection === 'email' ? null : 'email')}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="font-medium text-gray-900 dark:text-white">
              Changer l&apos;adresse email
            </span>
          </div>
          <span className="text-sm text-primary-600 dark:text-primary-400">
            {activeSection === 'email' ? 'Annuler' : 'Modifier'}
          </span>
        </button>

        {activeSection === 'email' && (
          <form onSubmit={handleEmailSubmit} className="p-4 pt-0 space-y-4">
            <Input
              label="Nouvelle adresse email"
              type="email"
              name="newEmail"
              value={emailForm.newEmail}
              onChange={handleEmailChange}
              required
            />
            <Input
              label="Mot de passe actuel"
              type="password"
              name="currentPassword"
              value={emailForm.currentPassword}
              onChange={handleEmailChange}
              hint="Requis pour confirmer le changement"
              required
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Mise à jour...
                </>
              ) : (
                'Mettre à jour l\'email'
              )}
            </Button>
          </form>
        )}
      </div>

      {/* Password Change Section */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
        <button
          type="button"
          onClick={() => setActiveSection(activeSection === 'password' ? null : 'password')}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="font-medium text-gray-900 dark:text-white">
              Changer le mot de passe
            </span>
          </div>
          <span className="text-sm text-primary-600 dark:text-primary-400">
            {activeSection === 'password' ? 'Annuler' : 'Modifier'}
          </span>
        </button>

        {activeSection === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="p-4 pt-0 space-y-4">
            <Input
              label="Mot de passe actuel"
              type="password"
              name="currentPassword"
              value={passwordForm.currentPassword}
              onChange={handlePasswordChange}
              required
            />
            <Input
              label="Nouveau mot de passe"
              type="password"
              name="newPassword"
              value={passwordForm.newPassword}
              onChange={handlePasswordChange}
              hint="Au moins 6 caractères"
              required
            />
            <Input
              label="Confirmer le nouveau mot de passe"
              type="password"
              name="confirmPassword"
              value={passwordForm.confirmPassword}
              onChange={handlePasswordChange}
              required
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Mise à jour...
                </>
              ) : (
                'Mettre à jour le mot de passe'
              )}
            </Button>
          </form>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-4 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-4 bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* Security Info */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium">Sécurité du compte</p>
          <p className="mt-1 text-blue-600 dark:text-blue-400">
            Pour des raisons de sécurité, vous devez entrer votre mot de passe actuel
            pour modifier vos informations de connexion.
          </p>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
        <div className="p-4 border border-error-200 dark:border-error-800 rounded-lg bg-error-50 dark:bg-error-900/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-error-600 dark:text-error-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-error-700 dark:text-error-300">
                Zone dangereuse
              </h3>
              <p className="mt-2 text-sm text-error-600 dark:text-error-400">
                La suppression de votre compte est irréversible. Toutes vos données seront
                définitivement supprimées, y compris :
              </p>
              <ul className="mt-2 text-sm text-error-600 dark:text-error-400 list-disc list-inside space-y-1">
                <li>Votre profil prestataire et toutes ses informations</li>
                <li>Vos membres d&apos;équipe et leurs disponibilités</li>
                <li>Vos lieux et prestations</li>
                <li>Vos paramètres et préférences</li>
              </ul>
              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={openDeleteModal}
                  className="border-error-300 dark:border-error-700 text-error-700 dark:text-error-400 hover:bg-error-100 dark:hover:bg-error-900/40"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer mon compte
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      <Modal isOpen={showDeleteModal} onClose={closeDeleteModal}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Supprimer votre compte
            </h2>
            <button
              type="button"
              onClick={closeDeleteModal}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="mb-6">
            <div className="flex items-start gap-3 p-4 bg-error-50 dark:bg-error-900/20 rounded-lg mb-4">
              <AlertTriangle className="w-5 h-5 text-error-600 dark:text-error-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-error-700 dark:text-error-300">
                <p className="font-semibold">Cette action est irréversible</p>
                <p className="mt-1">
                  Une fois votre compte supprimé, toutes vos données seront définitivement
                  perdues et ne pourront pas être récupérées.
                </p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg mb-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Les données suivantes seront supprimées :
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Profil prestataire et informations d&apos;entreprise</li>
                <li>• Membres d&apos;équipe et disponibilités</li>
                <li>• Lieux et prestations</li>
                <li>• Créneaux bloqués et paramètres</li>
                <li>• Compte utilisateur et identifiants</li>
              </ul>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
                Note : L&apos;historique des rendez-vous et des avis sera conservé de manière anonyme.
              </p>
            </div>
          </div>

          <form onSubmit={handleDeleteAccount} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tapez <span className="font-bold text-error-600">SUPPRIMER</span> pour confirmer
              </label>
              <Input
                type="text"
                name="confirmText"
                value={deleteForm.confirmText}
                onChange={handleDeleteFormChange}
                placeholder="SUPPRIMER"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Entrez votre mot de passe
              </label>
              <Input
                type="password"
                name="password"
                value={deleteForm.password}
                onChange={handleDeleteFormChange}
                placeholder="Mot de passe"
                required
              />
            </div>

            {deleteError && (
              <div className="flex items-start gap-2 p-3 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 rounded-lg text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeDeleteModal}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={deleteLoading || deleteForm.confirmText !== 'SUPPRIMER'}
                className="flex-1 bg-error-600 hover:bg-error-700 text-white"
              >
                {deleteLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Confirmer la suppression
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
