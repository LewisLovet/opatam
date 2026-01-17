'use client';

import { useState, useEffect } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Badge } from '@/components/ui';
import { authService, auth, onAuthChange } from '@booking-app/firebase';

export default function AuthServiceTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [lastAction, setLastAction] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<{ uid: string; email: string | null } | null>(null);

  // Form states - Register Client
  const [registerEmail, setRegisterEmail] = useState('test@example.com');
  const [registerPassword, setRegisterPassword] = useState('test123');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('test123');
  const [registerDisplayName, setRegisterDisplayName] = useState('Test User');
  const [registerPhone, setRegisterPhone] = useState('0612345678');

  // Form states - Register Provider (simplifie: juste auth, pas de business info)
  const [providerEmail, setProviderEmail] = useState('provider@example.com');
  const [providerPassword, setProviderPassword] = useState('test123');
  const [providerConfirmPassword, setProviderConfirmPassword] = useState('test123');
  const [providerDisplayName, setProviderDisplayName] = useState('Mon Salon');
  const [providerPhone, setProviderPhone] = useState('0612345678');

  // Form states - Login
  const [loginEmail, setLoginEmail] = useState('test@example.com');
  const [loginPassword, setLoginPassword] = useState('test123');

  const [resetEmail, setResetEmail] = useState('test@example.com');

  // Listen to auth state
  useEffect(() => {
    const unsubscribe = onAuthChange((user: { uid: string; email: string | null } | null) => {
      if (user) {
        setCurrentUser({ uid: user.uid, email: user.email });
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const executeAction = async (action: string, fn: () => Promise<unknown>) => {
    setLoading(true);
    setError(null);
    setLastAction(action);
    try {
      const res = await fn();
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : JSON.stringify(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterClient = () =>
    executeAction('REGISTER CLIENT', async () => {
      const result = await authService.registerClient({
        email: registerEmail,
        password: registerPassword,
        confirmPassword: registerConfirmPassword,
        displayName: registerDisplayName,
        phone: registerPhone || undefined,
      });
      return {
        message: 'Client inscrit avec succes',
        userId: result.user.id,
        displayName: result.user.displayName,
        role: result.user.role,
        firebaseUid: result.credential.user.uid,
      };
    });

  const handleRegisterProvider = () =>
    executeAction('REGISTER PROVIDER', async () => {
      const result = await authService.registerProvider({
        email: providerEmail,
        password: providerPassword,
        confirmPassword: providerConfirmPassword,
        displayName: providerDisplayName,
        phone: providerPhone,
      });
      return {
        message: 'Provider inscrit avec succes (User cree, pas encore de Provider document)',
        userId: result.user.id,
        displayName: result.user.displayName,
        role: result.user.role,
        providerId: result.user.providerId, // null car pas encore de Provider document
        firebaseUid: result.credential.user.uid,
        nextStep: 'Utiliser providerService.createProvider() pour creer le Provider document (onboarding)',
      };
    });

  const handleLogin = () =>
    executeAction('LOGIN', async () => {
      const result = await authService.login({
        email: loginEmail,
        password: loginPassword,
      });
      return {
        message: 'Connexion reussie',
        userId: result.user.id,
        role: result.user.role,
        displayName: result.user.displayName,
        providerId: result.user.providerId,
        firebaseUid: result.credential.user.uid,
      };
    });

  const handleLoginWithGoogle = () =>
    executeAction('LOGIN GOOGLE', async () => {
      const result = await authService.loginWithGoogle();
      return {
        message: 'Connexion Google reussie',
        userId: result.user.id,
        role: result.user.role,
        isNewUser: result.isNewUser,
        firebaseUid: result.credential.user.uid,
      };
    });

  const handleLogout = () =>
    executeAction('LOGOUT', async () => {
      await authService.logout();
      return { message: 'Deconnexion reussie' };
    });

  const handleResetPassword = () =>
    executeAction('RESET PASSWORD', async () => {
      await authService.resetPassword(resetEmail);
      return { message: `Email de reinitialisation envoye a ${resetEmail}` };
    });

  const handleGetCurrentUser = () =>
    executeAction('GET CURRENT USER', async () => {
      const user = await authService.getCurrentUser();
      if (!user) {
        return { message: 'Aucun utilisateur connecte' };
      }
      return {
        message: 'Utilisateur trouve',
        user,
      };
    });

  const handleCheckOnboarding = () =>
    executeAction('CHECK ONBOARDING', async () => {
      if (!currentUser) {
        throw new Error('Aucun utilisateur connecte');
      }
      const hasCompleted = await authService.hasCompletedProviderOnboarding(currentUser.uid);
      return {
        userId: currentUser.uid,
        hasCompletedOnboarding: hasCompleted,
        message: hasCompleted
          ? 'Onboarding complete (Provider document existe)'
          : 'Onboarding non complete (Provider document manquant)',
      };
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Test Auth Service
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Test des operations d&apos;authentification: inscription, connexion, deconnexion.
        </p>
      </div>

      {/* Current User Status */}
      <Card variant="bordered" className={currentUser ? 'border-green-300 dark:border-green-700' : 'border-gray-300 dark:border-gray-700'}>
        <CardHeader
          title="Utilisateur actuel"
          action={
            <Badge variant={currentUser ? 'success' : 'default'}>
              {currentUser ? 'Connecte' : 'Deconnecte'}
            </Badge>
          }
        />
        <CardBody>
          {currentUser ? (
            <div className="text-sm space-y-1 text-gray-800 dark:text-gray-200">
              <p><strong>UID:</strong> {currentUser.uid}</p>
              <p><strong>Email:</strong> {currentUser.email}</p>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Aucun utilisateur connecte
            </p>
          )}
        </CardBody>
      </Card>

      {/* Register Client */}
      <Card>
        <CardHeader title="Inscription Client" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Email"
              type="email"
              value={registerEmail}
              onChange={(e) => setRegisterEmail(e.target.value)}
              placeholder="test@example.com"
            />
            <Input
              label="Mot de passe"
              type="password"
              value={registerPassword}
              onChange={(e) => {
                setRegisterPassword(e.target.value);
                setRegisterConfirmPassword(e.target.value);
              }}
              placeholder="Min 6 caracteres"
            />
            <Input
              label="Confirmer mot de passe"
              type="password"
              value={registerConfirmPassword}
              onChange={(e) => setRegisterConfirmPassword(e.target.value)}
              placeholder="Confirmer"
            />
            <Input
              label="Nom complet"
              value={registerDisplayName}
              onChange={(e) => setRegisterDisplayName(e.target.value)}
              placeholder="Test User"
            />
            <Input
              label="Telephone (optionnel)"
              value={registerPhone}
              onChange={(e) => setRegisterPhone(e.target.value)}
              placeholder="0612345678"
              hint="Format: 06 ou 07 + 8 chiffres"
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={handleRegisterClient}
              loading={loading && lastAction === 'REGISTER CLIENT'}
            >
              Inscrire Client
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Register Provider */}
      <Card>
        <CardHeader
          title="Inscription Provider"
          action={<Badge variant="warning">Etape 1 seulement</Badge>}
        />
        <CardBody>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Cree uniquement le User avec role &quot;provider&quot;. Le Provider document est cree a l&apos;onboarding.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Email"
              type="email"
              value={providerEmail}
              onChange={(e) => setProviderEmail(e.target.value)}
              placeholder="provider@example.com"
            />
            <Input
              label="Mot de passe"
              type="password"
              value={providerPassword}
              onChange={(e) => {
                setProviderPassword(e.target.value);
                setProviderConfirmPassword(e.target.value);
              }}
              placeholder="Min 6 caracteres"
            />
            <Input
              label="Confirmer mot de passe"
              type="password"
              value={providerConfirmPassword}
              onChange={(e) => setProviderConfirmPassword(e.target.value)}
              placeholder="Confirmer"
            />
            <Input
              label="Nom complet"
              value={providerDisplayName}
              onChange={(e) => setProviderDisplayName(e.target.value)}
              placeholder="Mon Salon"
            />
            <Input
              label="Telephone"
              value={providerPhone}
              onChange={(e) => setProviderPhone(e.target.value)}
              placeholder="0612345678"
              hint="Format: 06 ou 07 + 8 chiffres (requis)"
            />
          </div>
          <div className="mt-4 flex gap-3">
            <Button
              variant="outline"
              onClick={handleRegisterProvider}
              loading={loading && lastAction === 'REGISTER PROVIDER'}
            >
              Inscrire Provider
            </Button>
            <Button
              variant="ghost"
              onClick={handleCheckOnboarding}
              loading={loading && lastAction === 'CHECK ONBOARDING'}
              disabled={!currentUser}
            >
              Verifier Onboarding
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Login */}
      <Card>
        <CardHeader title="Connexion" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Email"
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="test@example.com"
            />
            <Input
              label="Mot de passe"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Mot de passe"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              onClick={handleLogin}
              loading={loading && lastAction === 'LOGIN'}
            >
              Connexion Email
            </Button>
            <Button
              variant="outline"
              onClick={handleLoginWithGoogle}
              loading={loading && lastAction === 'LOGIN GOOGLE'}
            >
              Connexion Google
            </Button>
            <Button
              variant="outline"
              onClick={handleLogout}
              loading={loading && lastAction === 'LOGOUT'}
              disabled={!currentUser}
            >
              Deconnexion
            </Button>
            <Button
              variant="ghost"
              onClick={handleGetCurrentUser}
              loading={loading && lastAction === 'GET CURRENT USER'}
            >
              Verifier session
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Reset Password */}
      <Card>
        <CardHeader title="Reset Mot de passe" />
        <CardBody>
          <div className="flex gap-3 items-end">
            <Input
              label="Email"
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="test@example.com"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleResetPassword}
              loading={loading && lastAction === 'RESET PASSWORD'}
            >
              Envoyer email
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Result */}
      <Card>
        <CardHeader
          title="Resultat"
          action={
            lastAction && (
              <Badge variant={error ? 'error' : 'success'}>
                {lastAction}
              </Badge>
            )
          }
        />
        <CardBody>
          {error ? (
            <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 font-medium">Erreur</p>
              <p className="text-red-500 dark:text-red-300 text-sm mt-1 whitespace-pre-wrap">{error}</p>
            </div>
          ) : result ? (
            <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm overflow-x-auto max-h-96 text-gray-800 dark:text-gray-200">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Executez une action pour voir le resultat ici.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
