'use client';

import { useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Badge } from '@/components/ui';
import { memberRepository } from '@booking-app/firebase';

export default function MembersTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [lastAction, setLastAction] = useState<string>('');

  // Provider ID (required for all operations)
  const [providerId, setProviderId] = useState('');

  // Form states
  const [createName, setCreateName] = useState('Jean Dupont');
  const [createEmail, setCreateEmail] = useState('jean@example.com');
  const [createPhone, setCreatePhone] = useState('0612345678');

  const [createLocationId, setCreateLocationId] = useState('');

  const [searchMemberId, setSearchMemberId] = useState('');
  const [searchAccessCode, setSearchAccessCode] = useState('');
  const [searchLocationId, setSearchLocationId] = useState('');
  const [deleteMemberId, setDeleteMemberId] = useState('');

  const [updateMemberId, setUpdateMemberId] = useState('');
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

  const generateAccessCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // NOUVEAU MODÈLE: locationId est obligatoire (1 membre = 1 lieu)
  const handleCreate = () =>
    executeAction('CREATE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!createLocationId) throw new Error('Location ID requis (nouveau modele: 1 membre = 1 lieu)');
      const accessCode = generateAccessCode();
      const id = await memberRepository.create(providerId, {
        name: createName,
        email: createEmail,
        phone: createPhone,
        photoURL: null,
        accessCode,
        locationId: createLocationId,
        isDefault: false,
        isActive: true,
        sortOrder: 0,
      });
      return { id, accessCode, message: 'Member cree avec succes' };
    });

  const handleGetByProvider = () =>
    executeAction('GET BY PROVIDER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const members = await memberRepository.getByProvider(providerId);
      return { count: members.length, members };
    });

  const handleGetActiveByProvider = () =>
    executeAction('GET ACTIVE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const members = await memberRepository.getActiveByProvider(providerId);
      return { count: members.length, members };
    });

  const handleGetById = () =>
    executeAction('GET BY ID', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!searchMemberId) throw new Error('Member ID requis');
      const member = await memberRepository.getById(providerId, searchMemberId);
      return member || { message: 'Member non trouve' };
    });

  const handleGetByAccessCode = () =>
    executeAction('GET BY ACCESS CODE', async () => {
      if (!searchAccessCode) throw new Error('Access code requis');
      const member = await memberRepository.getByAccessCode(searchAccessCode);
      return member || { message: 'Member non trouve' };
    });

  const handleGetByLocation = () =>
    executeAction('GET BY LOCATION', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!searchLocationId) throw new Error('Location ID requis');
      const members = await memberRepository.getByLocation(providerId, searchLocationId);
      return { count: members.length, members };
    });

  const handleUpdate = () =>
    executeAction('UPDATE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!updateMemberId) throw new Error('Member ID requis');
      if (!updateName) throw new Error('Nouveau nom requis');
      await memberRepository.update(providerId, updateMemberId, { name: updateName });
      return { message: 'Member mis a jour avec succes', id: updateMemberId };
    });

  const handleToggleActive = () =>
    executeAction('TOGGLE ACTIVE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!updateMemberId) throw new Error('Member ID requis');
      const member = await memberRepository.getById(providerId, updateMemberId);
      if (!member) throw new Error('Member non trouve');
      await memberRepository.toggleActive(providerId, updateMemberId, !member.isActive);
      return { message: `Member ${!member.isActive ? 'active' : 'desactive'}`, id: updateMemberId };
    });

  const handleDelete = () =>
    executeAction('DELETE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!deleteMemberId) throw new Error('Member ID requis');
      await memberRepository.delete(providerId, deleteMemberId);
      return { message: 'Member supprime avec succes', id: deleteMemberId };
    });

  const handleCount = () =>
    executeAction('COUNT', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const count = await memberRepository.countByProvider(providerId);
      return { count, message: `${count} member(s) pour ce provider` };
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Test Members Repository
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Test des operations CRUD sur la sous-collection providers/&#123;id&#125;/members.
        </p>
      </div>

      {/* Provider ID - Required for most operations */}
      <Card variant="bordered" className="border-primary-300 dark:border-primary-700">
        <CardHeader title="Provider ID (requis)" />
        <CardBody>
          <Input
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            placeholder="ID du provider parent"
            hint="Copiez l'ID d'un provider depuis la page Providers"
          />
        </CardBody>
      </Card>

      {/* Create */}
      <Card>
        <CardHeader title="Creer un Member" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Nom"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Jean Dupont"
            />
            <Input
              label="Email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              placeholder="jean@example.com"
            />
            <Input
              label="Telephone"
              value={createPhone}
              onChange={(e) => setCreatePhone(e.target.value)}
              placeholder="0612345678"
            />
            <Input
              label="Location ID (requis)"
              value={createLocationId}
              onChange={(e) => setCreateLocationId(e.target.value)}
              placeholder="ID du lieu"
              hint="1 membre = 1 lieu"
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={handleCreate}
              loading={loading && lastAction === 'CREATE'}
              disabled={!providerId || !createLocationId}
            >
              Creer Member
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Read */}
      <Card>
        <CardHeader title="Lire des Members" />
        <CardBody>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleGetByProvider}
                loading={loading && lastAction === 'GET BY PROVIDER'}
                disabled={!providerId}
              >
                Tous les members
              </Button>
              <Button
                variant="outline"
                onClick={handleGetActiveByProvider}
                loading={loading && lastAction === 'GET ACTIVE'}
                disabled={!providerId}
              >
                Members actifs
              </Button>
              <Button
                variant="outline"
                onClick={handleCount}
                loading={loading && lastAction === 'COUNT'}
                disabled={!providerId}
              >
                Compter
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <Input
                label="Chercher par Member ID"
                value={searchMemberId}
                onChange={(e) => setSearchMemberId(e.target.value)}
                placeholder="ID du member"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleGetById}
                loading={loading && lastAction === 'GET BY ID'}
                disabled={!providerId}
              >
                Chercher
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <Input
                label="Chercher par Access Code (global)"
                value={searchAccessCode}
                onChange={(e) => setSearchAccessCode(e.target.value)}
                placeholder="ABC123"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleGetByAccessCode}
                loading={loading && lastAction === 'GET BY ACCESS CODE'}
              >
                Chercher
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <Input
                label="Chercher par Location ID"
                value={searchLocationId}
                onChange={(e) => setSearchLocationId(e.target.value)}
                placeholder="ID de la location"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleGetByLocation}
                loading={loading && lastAction === 'GET BY LOCATION'}
                disabled={!providerId}
              >
                Chercher
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Update */}
      <Card>
        <CardHeader title="Modifier un Member" />
        <CardBody>
          <div className="flex gap-3 items-end flex-wrap">
            <Input
              label="Member ID"
              value={updateMemberId}
              onChange={(e) => setUpdateMemberId(e.target.value)}
              placeholder="ID"
              className="flex-1 min-w-[200px]"
            />
            <Input
              label="Nouveau Nom"
              value={updateName}
              onChange={(e) => setUpdateName(e.target.value)}
              placeholder="Nouveau nom"
              className="flex-1 min-w-[200px]"
            />
            <Button
              variant="outline"
              onClick={handleUpdate}
              loading={loading && lastAction === 'UPDATE'}
              disabled={!providerId}
            >
              Modifier
            </Button>
            <Button
              variant="outline"
              onClick={handleToggleActive}
              loading={loading && lastAction === 'TOGGLE ACTIVE'}
              disabled={!providerId}
            >
              Toggle Actif
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Delete */}
      <Card>
        <CardHeader title="Supprimer un Member" />
        <CardBody>
          <div className="flex gap-3 items-end">
            <Input
              label="Member ID a supprimer"
              value={deleteMemberId}
              onChange={(e) => setDeleteMemberId(e.target.value)}
              placeholder="ID"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleDelete}
              loading={loading && lastAction === 'DELETE'}
              disabled={!providerId}
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
