'use client';

import { useState } from 'react';
import { Button, Card, CardBody, CardHeader, Badge } from '@/components/ui';
import { app, db, auth, storage } from '@booking-app/firebase';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  data?: unknown;
}

export default function FirebaseConnectionPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (result: TestResult) => {
    setResults((prev) => [...prev, result]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const testFirebaseApp = async () => {
    try {
      const appName = app.name;
      const options = app.options;
      addResult({
        name: 'Firebase App',
        success: true,
        message: `App initialisee: ${appName}`,
        data: {
          name: appName,
          projectId: options.projectId,
          authDomain: options.authDomain,
        },
      });
    } catch (error) {
      addResult({
        name: 'Firebase App',
        success: false,
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  };

  const testFirestore = async () => {
    try {
      const firestoreApp = db.app.name;
      addResult({
        name: 'Firestore',
        success: true,
        message: `Firestore connecte a l'app: ${firestoreApp}`,
        data: {
          type: db.type,
        },
      });
    } catch (error) {
      addResult({
        name: 'Firestore',
        success: false,
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  };

  const testAuth = async () => {
    try {
      const authApp = auth.app.name;
      const currentUser = auth.currentUser;
      addResult({
        name: 'Firebase Auth',
        success: true,
        message: `Auth connecte a l'app: ${authApp}`,
        data: {
          currentUser: currentUser ? currentUser.email : 'Non connecte',
        },
      });
    } catch (error) {
      addResult({
        name: 'Firebase Auth',
        success: false,
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  };

  const testStorage = async () => {
    try {
      const storageApp = storage.app.name;
      addResult({
        name: 'Firebase Storage',
        success: true,
        message: `Storage connecte a l'app: ${storageApp}`,
        data: {
          bucket: storage.app.options.storageBucket,
        },
      });
    } catch (error) {
      addResult({
        name: 'Firebase Storage',
        success: false,
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  };

  const runAllTests = async () => {
    setLoading(true);
    clearResults();

    await testFirebaseApp();
    await testFirestore();
    await testAuth();
    await testStorage();

    setLoading(false);
  };

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Test Connexion Firebase
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Verifie que tous les services Firebase sont correctement configures et accessibles.
        </p>
      </div>

      {/* Actions */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <Button onClick={runAllTests} loading={loading}>
              Lancer tous les tests
            </Button>
            <Button variant="outline" onClick={testFirebaseApp} disabled={loading}>
              Test App
            </Button>
            <Button variant="outline" onClick={testFirestore} disabled={loading}>
              Test Firestore
            </Button>
            <Button variant="outline" onClick={testAuth} disabled={loading}>
              Test Auth
            </Button>
            <Button variant="outline" onClick={testStorage} disabled={loading}>
              Test Storage
            </Button>
            <Button variant="ghost" onClick={clearResults} disabled={loading}>
              Effacer
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Summary */}
      {results.length > 0 && (
        <div className="flex gap-4">
          <Badge variant="success" size="md">
            {successCount} succes
          </Badge>
          {failCount > 0 && (
            <Badge variant="error" size="md">
              {failCount} echec(s)
            </Badge>
          )}
        </div>
      )}

      {/* Results */}
      <div className="space-y-4">
        {results.map((result, index) => (
          <Card key={index} variant={result.success ? 'default' : 'bordered'}>
            <CardHeader
              title={result.name}
              action={
                <Badge variant={result.success ? 'success' : 'error'}>
                  {result.success ? 'OK' : 'ERREUR'}
                </Badge>
              }
            />
            <CardBody>
              <p className={`text-sm ${result.success ? 'text-gray-600 dark:text-gray-400' : 'text-red-600 dark:text-red-400'}`}>
                {result.message}
              </p>
              {result.data ? (
                <pre className="mt-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs overflow-x-auto text-gray-800 dark:text-gray-200">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              ) : null}
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Environment Info */}
      <Card>
        <CardHeader title="Variables d'environnement" />
        <CardBody>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">NEXT_PUBLIC_FIREBASE_PROJECT_ID</span>
              <code className="text-gray-900 dark:text-gray-100">
                {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'Non defini'}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</span>
              <code className="text-gray-900 dark:text-gray-100">
                {process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'Non defini'}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">NEXT_PUBLIC_FIREBASE_API_KEY</span>
              <code className="text-gray-900 dark:text-gray-100">
                {process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '***' + process.env.NEXT_PUBLIC_FIREBASE_API_KEY.slice(-4) : 'Non defini'}
              </code>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
