'use client';

import { useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Badge } from '@/components/ui';
import { userRepository, type WithId } from '@booking-app/firebase';
import type { User } from '@booking-app/shared';

export default function UsersTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [lastAction, setLastAction] = useState<string>('');

  // Form states
  const [createEmail, setCreateEmail] = useState('test@example.com');
  const [createName, setCreateName] = useState('Test User');
  const [createPhone, setCreatePhone] = useState('0612345678');

  const [searchId, setSearchId] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [deleteId, setDeleteId] = useState('');

  const [updateId, setUpdateId] = useState('');
  const [updateName, setUpdateName] = useState('');

  const executeAction = async (action: string, fn: () => Promise<unknown>) => {
    setLoading(true);
    setError(null);
    setLastAction(action);
    try {
      const res = await fn();
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () =>
    executeAction('CREATE', async () => {
      const id = await userRepository.create({
        email: createEmail,
        displayName: createName,
        phone: createPhone,
        photoURL: null,
        role: 'client',
        providerId: null,
        city: null,
        birthYear: null,
        gender: null,
        cancellationCount: 0,
      });
      return { id, message: 'User cree avec succes' };
    });

  const handleGetAll = () =>
    executeAction('GET ALL', async () => {
      const users = await userRepository.getAll();
      return { count: users.length, users };
    });

  const handleGetById = () =>
    executeAction('GET BY ID', async () => {
      if (!searchId) throw new Error('ID requis');
      const user = await userRepository.getById(searchId);
      return user || { message: 'User non trouve' };
    });

  const handleGetByEmail = () =>
    executeAction('GET BY EMAIL', async () => {
      if (!searchEmail) throw new Error('Email requis');
      const user = await userRepository.getByEmail(searchEmail);
      return user || { message: 'User non trouve' };
    });

  const handleUpdate = () =>
    executeAction('UPDATE', async () => {
      if (!updateId) throw new Error('ID requis');
      if (!updateName) throw new Error('Nouveau nom requis');
      await userRepository.update(updateId, { displayName: updateName });
      return { message: 'User mis a jour avec succes', id: updateId };
    });

  const handleDelete = () =>
    executeAction('DELETE', async () => {
      if (!deleteId) throw new Error('ID requis');
      await userRepository.delete(deleteId);
      return { message: 'User supprime avec succes', id: deleteId };
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Test Users Repository
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Test des operations CRUD sur la collection users.
        </p>
      </div>

      {/* Create */}
      <Card>
        <CardHeader title="Creer un User" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              placeholder="test@example.com"
            />
            <Input
              label="Nom"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Test User"
            />
            <Input
              label="Telephone"
              value={createPhone}
              onChange={(e) => setCreatePhone(e.target.value)}
              placeholder="0612345678"
            />
          </div>
          <div className="mt-4">
            <Button onClick={handleCreate} loading={loading && lastAction === 'CREATE'}>
              Creer User
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Read */}
      <Card>
        <CardHeader title="Lire des Users" />
        <CardBody>
          <div className="space-y-4">
            <div>
              <Button onClick={handleGetAll} loading={loading && lastAction === 'GET ALL'}>
                Lister tous les users
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <Input
                label="Chercher par ID"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="ID du user"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleGetById}
                loading={loading && lastAction === 'GET BY ID'}
              >
                Chercher
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <Input
                label="Chercher par Email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleGetByEmail}
                loading={loading && lastAction === 'GET BY EMAIL'}
              >
                Chercher
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Update */}
      <Card>
        <CardHeader title="Modifier un User" />
        <CardBody>
          <div className="flex gap-3 items-end">
            <Input
              label="ID du User"
              value={updateId}
              onChange={(e) => setUpdateId(e.target.value)}
              placeholder="ID"
              className="flex-1"
            />
            <Input
              label="Nouveau Nom"
              value={updateName}
              onChange={(e) => setUpdateName(e.target.value)}
              placeholder="Nouveau nom"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleUpdate}
              loading={loading && lastAction === 'UPDATE'}
            >
              Modifier
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Delete */}
      <Card>
        <CardHeader title="Supprimer un User" />
        <CardBody>
          <div className="flex gap-3 items-end">
            <Input
              label="ID du User a supprimer"
              value={deleteId}
              onChange={(e) => setDeleteId(e.target.value)}
              placeholder="ID"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleDelete}
              loading={loading && lastAction === 'DELETE'}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Supprimer
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
              <p className="text-red-500 dark:text-red-300 text-sm mt-1">{error}</p>
            </div>
          ) : result ? (
            <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm overflow-x-auto text-gray-800 dark:text-gray-200">
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
