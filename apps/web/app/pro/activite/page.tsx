'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { Scissors, MapPin, Users, Clock } from 'lucide-react';
import { PrestationsTab } from './components/PrestationsTab';
import { LieuxTab } from './components/LieuxTab';

export default function ActivityPage() {
  const { provider } = useAuth();
  const [activeTab, setActiveTab] = useState('prestations');

  const isTeamPlan = provider?.plan === 'team';

  const tabs = [
    { id: 'prestations', label: 'Prestations', icon: <Scissors className="w-4 h-4" /> },
    { id: 'lieux', label: 'Lieux', icon: <MapPin className="w-4 h-4" /> },
    ...(isTeamPlan
      ? [{ id: 'equipe', label: 'Equipe', icon: <Users className="w-4 h-4" /> }]
      : []),
    { id: 'disponibilites', label: 'Disponibilites', icon: <Clock className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Mon activite
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Gerez vos prestations, lieux et disponibilites
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
            <PlaceholderTab title="Equipe" description="La gestion de l'equipe arrive bientot." />
          </TabsContent>
        )}

        {/* Disponibilites Tab */}
        <TabsContent value="disponibilites" className="mt-6">
          <PlaceholderTab
            title="Disponibilites"
            description="La gestion des disponibilites arrive bientot."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Placeholder component for tabs not yet implemented
function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </div>
  );
}
