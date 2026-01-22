'use client';

import { useState } from 'react';
import { Card, CardHeader, CardBody, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import {
  Calendar,
  Bell,
  User,
  CreditCard,
} from 'lucide-react';
import {
  ReservationSettingsForm,
  NotificationsForm,
  AccountForm,
  SubscriptionSection,
} from './components';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('reservation');

  const tabs = [
    { id: 'reservation', label: 'Reservation', icon: <Calendar className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'compte', label: 'Compte', icon: <User className="w-4 h-4" /> },
    { id: 'abonnement', label: 'Abonnement', icon: <CreditCard className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Parametres
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Configurez votre activite et votre compte
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="reservation" value={activeTab} onValueChange={setActiveTab}>
        {/* Tab List */}
        <TabsList className="w-fit">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Reservation Tab */}
        <TabsContent value="reservation" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Parametres de reservation
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Definissez les regles de reservation pour vos clients
              </p>
            </CardHeader>
            <CardBody>
              <ReservationSettingsForm />
            </CardBody>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Notifications et rappels
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configurez les rappels automatiques envoyes a vos clients
              </p>
            </CardHeader>
            <CardBody>
              <NotificationsForm />
            </CardBody>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="compte" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Informations du compte
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Gerez vos identifiants de connexion
              </p>
            </CardHeader>
            <CardBody>
              <AccountForm />
            </CardBody>
          </Card>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="abonnement" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Abonnement
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Gerez votre abonnement et vos factures
              </p>
            </CardHeader>
            <CardBody>
              <SubscriptionSection />
            </CardBody>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
