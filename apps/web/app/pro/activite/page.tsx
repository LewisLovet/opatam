'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { Scissors, MapPin, Users, Clock } from 'lucide-react';
import { PrestationsTab } from './components/PrestationsTab';
import { LieuxTab } from './components/LieuxTab';
import { EquipeTab } from './components/EquipeTab';
import { DisponibilitesTab } from './components/DisponibilitesTab';

export default function ActivityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { provider } = useAuth();

  const activeTab = searchParams.get('tab') || 'prestations';

  const setActiveTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      router.push(`/pro/activite?${params.toString()}`);
    },
    [router, searchParams]
  );

  const isTeamPlan = provider?.plan === 'team' || provider?.plan === 'trial';

  const tabs = [
    { id: 'prestations', label: 'Prestations', icon: <Scissors className="w-4 h-4" /> },
    { id: 'lieux', label: 'Lieux', icon: <MapPin className="w-4 h-4" /> },
    ...(isTeamPlan
      ? [{ id: 'equipe', label: 'Équipe', icon: <Users className="w-4 h-4" /> }]
      : []),
    { id: 'disponibilites', label: 'Disponibilités', icon: <Clock className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Mon activité
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Gérez vos prestations, lieux et disponibilités
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="prestations" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-fit">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Prestations Tab */}
        <TabsContent value="prestations" className="mt-6">
          <PrestationsTab />
        </TabsContent>

        {/* Lieux Tab */}
        <TabsContent value="lieux" className="mt-6">
          <LieuxTab />
        </TabsContent>

        {/* Equipe Tab (Teams only) */}
        {isTeamPlan && (
          <TabsContent value="equipe" className="mt-6">
            <EquipeTab />
          </TabsContent>
        )}

        {/* Disponibilites Tab */}
        <TabsContent value="disponibilites" className="mt-6">
          <DisponibilitesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
