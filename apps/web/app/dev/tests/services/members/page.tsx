'use client';

import { useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Badge } from '@/components/ui';
import { memberService, memberRepository } from '@booking-app/firebase';

export default function MembersServiceTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [lastAction, setLastAction] = useState<string>('');

  // Form states
  const [providerId, setProviderId] = useState('');
  const [memberId, setMemberId] = useState('');

  // Create form - NOUVEAU MODÈLE: locationId obligatoire (1 membre = 1 lieu)
  const [createName, setCreateName] = useState('Marie Dupont');
  const [createEmail, setCreateEmail] = useState('marie@salon.com');
  const [createPhone, setCreatePhone] = useState('0612345678');
  const [createRole, setCreateRole] = useState('Coiffeuse');
  const [createLocationId, setCreateLocationId] = useState(''); // Obligatoire maintenant
  const [createColor, setCreateColor] = useState('#FF5733');

  // Update form
  const [updateName, setUpdateName] = useState('');
  const [updateEmail, setUpdateEmail] = useState('');
  const [updatePhone, setUpdatePhone] = useState('');
  const [updateRole, setUpdateRole] = useState('');

  // Search form
  const [searchAccessCode, setSearchAccessCode] = useState('');
  const [searchLocationId, setSearchLocationId] = useState('');

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

  // NOUVEAU MODÈLE: locationId est obligatoire (1 membre = 1 lieu)
  const handleCreateMember = () =>
    executeAction('CREATE MEMBER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!createLocationId) throw new Error('Location ID requis (nouveau modele: 1 membre = 1 lieu)');

      const member = await memberService.createMember(providerId, {
        name: createName,
        email: createEmail,
        phone: createPhone || undefined,
        locationId: createLocationId, // NOUVEAU: un seul lieu
        isDefault: false,
        serviceIds: [],
        color: createColor || undefined,
      });
      setMemberId(member.id);
      return {
        message: 'Membre cree avec succes',
        member,
        accessCode: member.accessCode,
      };
    });

  const handleUpdateMember = () =>
    executeAction('UPDATE MEMBER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!memberId) throw new Error('Member ID requis');

      const updateData: Record<string, string | undefined> = {};
      if (updateName) updateData.name = updateName;
      if (updateEmail) updateData.email = updateEmail;
      if (updatePhone) updateData.phone = updatePhone;
      if (updateRole) updateData.role = updateRole;

      if (Object.keys(updateData).length === 0) {
        throw new Error('Au moins un champ a modifier');
      }

      await memberService.updateMember(providerId, memberId, updateData);
      const member = await memberRepository.getById(providerId, memberId);
      return {
        message: 'Membre mis a jour',
        member,
      };
    });

  const handleDeleteMember = () =>
    executeAction('DELETE MEMBER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!memberId) throw new Error('Member ID requis');
      await memberService.deleteMember(providerId, memberId);
      return {
        message: 'Membre supprime avec succes',
        memberId,
      };
    });

  const handleDeactivateMember = () =>
    executeAction('DEACTIVATE MEMBER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!memberId) throw new Error('Member ID requis');
      await memberService.deactivateMember(providerId, memberId);
      const member = await memberRepository.getById(providerId, memberId);
      return {
        message: 'Membre desactive',
        isActive: member?.isActive,
      };
    });

  const handleReactivateMember = () =>
    executeAction('REACTIVATE MEMBER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!memberId) throw new Error('Member ID requis');
      await memberService.reactivateMember(providerId, memberId);
      const member = await memberRepository.getById(providerId, memberId);
      return {
        message: 'Membre reactive',
        isActive: member?.isActive,
      };
    });

  const handleRegenerateAccessCode = () =>
    executeAction('REGENERATE ACCESS CODE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!memberId) throw new Error('Member ID requis');
      const newAccessCode = await memberService.regenerateAccessCode(providerId, memberId);
      return {
        message: 'Code d\'acces regenere',
        newAccessCode,
      };
    });

  const handleGetByAccessCode = () =>
    executeAction('GET BY ACCESS CODE', async () => {
      if (!searchAccessCode) throw new Error('Code d\'acces requis');
      const result = await memberService.getMemberByAccessCode(searchAccessCode);
      if (!result) {
        return { message: 'Membre non trouve avec ce code' };
      }
      return {
        message: 'Membre trouve',
        providerId: result.providerId,
        member: result,
      };
    });

  const handleGetByProvider = () =>
    executeAction('GET BY PROVIDER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const members = await memberService.getByProvider(providerId);
      return {
        count: members.length,
        members: members.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          accessCode: m.accessCode,
          isActive: m.isActive,
          isDefault: m.isDefault,
          locationId: m.locationId, // NOUVEAU MODÈLE: un seul lieu
        })),
      };
    });

  const handleGetActiveByProvider = () =>
    executeAction('GET ACTIVE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const members = await memberService.getActiveByProvider(providerId);
      return {
        count: members.length,
        members: members.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          // role removed from Member type
          accessCode: m.accessCode,
        })),
      };
    });

  const handleGetByLocation = () =>
    executeAction('GET BY LOCATION', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!searchLocationId) throw new Error('Location ID requis');
      const members = await memberService.getByLocation(providerId, searchLocationId);
      return {
        count: members.length,
        members: members.map((m) => ({
          id: m.id,
          name: m.name,
          accessCode: m.accessCode,
          isActive: m.isActive,
        })),
      };
    });

  const handleGetById = () =>
    executeAction('GET BY ID', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!memberId) throw new Error('Member ID requis');
      const member = await memberService.getById(providerId, memberId);
      if (!member) {
        return { message: 'Membre non trouve' };
      }
      return {
        message: 'Membre trouve',
        member,
      };
    });

  // NOUVEAU MODÈLE: changeLocation au lieu de add/remove
  const handleChangeLocation = () =>
    executeAction('CHANGE LOCATION', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!memberId) throw new Error('Member ID requis');
      if (!searchLocationId) throw new Error('Location ID requis');
      await memberService.changeLocation(providerId, memberId, searchLocationId);
      const member = await memberRepository.getById(providerId, memberId);
      return {
        message: 'Location changee (disponibilites mises a jour)',
        locationId: member?.locationId,
      };
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Test Members Service
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Test des operations membres: creation avec code d&apos;acces, gestion des locations, activation/desactivation.
        </p>
      </div>

      {/* IDs */}
      <Card variant="bordered" className="border-primary-300 dark:border-primary-700">
        <CardHeader title="IDs" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Provider ID"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              placeholder="ID du provider"
              hint="Requis pour toutes les operations"
            />
            <Input
              label="Member ID"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              placeholder="ID du membre"
              hint="Auto-rempli apres creation"
            />
          </div>
        </CardBody>
      </Card>

      {/* Create Member */}
      <Card>
        <CardHeader title="Creer un Membre" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Nom complet"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Marie Dupont"
            />
            <Input
              label="Email"
              type="email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              placeholder="marie@salon.com"
            />
            <Input
              label="Telephone"
              value={createPhone}
              onChange={(e) => setCreatePhone(e.target.value)}
              placeholder="0612345678"
              hint="Format: 06/07 + 8 chiffres"
            />
            <Input
              label="Role (optionnel)"
              value={createRole}
              onChange={(e) => setCreateRole(e.target.value)}
              placeholder="Coiffeuse"
              hint="Ex: Coiffeuse, Barbier, Manager"
            />
            <Input
              label="Location ID (requis)"
              value={createLocationId}
              onChange={(e) => setCreateLocationId(e.target.value)}
              placeholder="location-1"
              hint="1 membre = 1 lieu"
            />
            <Input
              label="Couleur (optionnel)"
              value={createColor}
              onChange={(e) => setCreateColor(e.target.value)}
              placeholder="#FF5733"
              hint="Format: #RRGGBB"
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={handleCreateMember}
              loading={loading && lastAction === 'CREATE MEMBER'}
              disabled={!providerId || !createLocationId}
            >
              Creer Membre
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Update Member */}
      <Card>
        <CardHeader title="Modifier un Membre" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Nouveau nom"
              value={updateName}
              onChange={(e) => setUpdateName(e.target.value)}
              placeholder="Laisser vide pour ignorer"
            />
            <Input
              label="Nouvel email"
              value={updateEmail}
              onChange={(e) => setUpdateEmail(e.target.value)}
              placeholder="Laisser vide pour ignorer"
            />
            <Input
              label="Nouveau telephone"
              value={updatePhone}
              onChange={(e) => setUpdatePhone(e.target.value)}
              placeholder="0612345678"
            />
            <Input
              label="Nouveau role"
              value={updateRole}
              onChange={(e) => setUpdateRole(e.target.value)}
              placeholder="Laisser vide pour ignorer"
            />
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={handleUpdateMember}
              loading={loading && lastAction === 'UPDATE MEMBER'}
              disabled={!providerId || !memberId}
            >
              Modifier Membre
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Member Actions */}
      <Card>
        <CardHeader title="Actions Membre" />
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleGetById}
              loading={loading && lastAction === 'GET BY ID'}
              disabled={!providerId || !memberId}
            >
              Voir Details
            </Button>
            <Button
              variant="outline"
              onClick={handleDeactivateMember}
              loading={loading && lastAction === 'DEACTIVATE MEMBER'}
              disabled={!providerId || !memberId}
            >
              Desactiver
            </Button>
            <Button
              variant="outline"
              onClick={handleReactivateMember}
              loading={loading && lastAction === 'REACTIVATE MEMBER'}
              disabled={!providerId || !memberId}
            >
              Reactiver
            </Button>
            <Button
              variant="outline"
              onClick={handleRegenerateAccessCode}
              loading={loading && lastAction === 'REGENERATE ACCESS CODE'}
              disabled={!providerId || !memberId}
            >
              Regenerer Code
            </Button>
            <Button
              variant="outline"
              onClick={handleDeleteMember}
              loading={loading && lastAction === 'DELETE MEMBER'}
              disabled={!providerId || !memberId}
              className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950"
            >
              Supprimer
            </Button>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Note: La suppression echouera si le membre a des reservations futures.
          </p>
        </CardBody>
      </Card>

      {/* Location Management - NOUVEAU MODÈLE */}
      <Card>
        <CardHeader title="Gestion de la Location (1 membre = 1 lieu)" />
        <CardBody>
          <div className="flex gap-3 items-end flex-wrap">
            <Input
              label="Nouvelle Location ID"
              value={searchLocationId}
              onChange={(e) => setSearchLocationId(e.target.value)}
              placeholder="location-1"
              className="flex-1 min-w-[200px]"
            />
            <Button
              variant="outline"
              onClick={handleChangeLocation}
              loading={loading && lastAction === 'CHANGE LOCATION'}
              disabled={!providerId || !memberId || !searchLocationId}
            >
              Changer Location
            </Button>
            <Button
              variant="outline"
              onClick={handleGetByLocation}
              loading={loading && lastAction === 'GET BY LOCATION'}
              disabled={!providerId || !searchLocationId}
            >
              Membres par Location
            </Button>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Le changement de location met automatiquement a jour les disponibilites du membre.
          </p>
        </CardBody>
      </Card>

      {/* Search by Access Code */}
      <Card>
        <CardHeader title="Recherche par Code d'Acces" />
        <CardBody>
          <div className="flex gap-3 items-end">
            <Input
              label="Code d'acces"
              value={searchAccessCode}
              onChange={(e) => setSearchAccessCode(e.target.value.toUpperCase())}
              placeholder="MARIE-A1B2"
              className="flex-1"
              hint="Format: NOM-XXXX"
            />
            <Button
              variant="outline"
              onClick={handleGetByAccessCode}
              loading={loading && lastAction === 'GET BY ACCESS CODE'}
            >
              Chercher
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* List Members */}
      <Card>
        <CardHeader title="Lister les Membres" />
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleGetByProvider}
              loading={loading && lastAction === 'GET BY PROVIDER'}
              disabled={!providerId}
            >
              Tous les membres
            </Button>
            <Button
              variant="outline"
              onClick={handleGetActiveByProvider}
              loading={loading && lastAction === 'GET ACTIVE'}
              disabled={!providerId}
            >
              Membres actifs
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
