'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardBody, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import {
  User,
  Image,
  Globe,
  ExternalLink,
} from 'lucide-react';
import {
  ProfileForm,
  PhotoUpload,
  CoverPhotoUpload,
  PortfolioUpload,
  SocialLinksForm,
  PublicationSection,
} from './components';

const TAB_IDS = ['publication', 'profil', 'portfolio'] as const;

export default function ProfilPage() {
  const { provider } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    TAB_IDS.includes(tabFromUrl as typeof TAB_IDS[number]) ? tabFromUrl! : 'publication'
  );

  // Sync URL → state
  useEffect(() => {
    if (tabFromUrl && TAB_IDS.includes(tabFromUrl as typeof TAB_IDS[number])) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    router.replace(`/pro/profil?tab=${tabId}`, { scroll: false });
  };

  const tabs = [
    { id: 'publication', label: 'Visibilité', icon: <Globe className="w-4 h-4" /> },
    { id: 'profil', label: 'Profil', icon: <User className="w-4 h-4" /> },
    { id: 'portfolio', label: 'Portfolio', icon: <Image className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Profil public
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Gérez les informations visibles par vos clients
          </p>
        </div>
        {provider?.slug && (
          <a
            href={`/p/${provider.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Voir ma page publique
          </a>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="publication" value={activeTab} onValueChange={handleTabChange}>
        {/* Tab List */}
        <TabsList className="w-fit">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Visibilité Tab (1st - most important) */}
        <TabsContent value="publication" className="mt-6">
          <PublicationSection />
        </TabsContent>

        {/* Mon profil Tab (2nd - merged Infos + Photos + Réseaux) */}
        <TabsContent value="profil" className="mt-6">
          <div className="space-y-6">
            {/* Section 1: Identité visuelle (cover + logo together) */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Identité visuelle
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Photo de profil et photo de couverture affichées sur votre page publique
                </p>
              </CardHeader>
              <CardBody>
                <div className="space-y-6">
                  <CoverPhotoUpload />
                  <div className="border-t border-gray-200 dark:border-gray-700" />
                  <PhotoUpload />
                </div>
              </CardBody>
            </Card>

            {/* Section 2: Informations générales */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Informations générales
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Ces informations seront visibles sur votre page publique
                </p>
              </CardHeader>
              <CardBody>
                <ProfileForm />
              </CardBody>
            </Card>

            {/* Section 3: Réseaux sociaux */}
            <Card className="max-w-2xl">
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Réseaux sociaux
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Ajoutez vos liens pour permettre aux clients de vous suivre
                </p>
              </CardHeader>
              <CardBody>
                <SocialLinksForm />
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        {/* Portfolio Tab (3rd) */}
        <TabsContent value="portfolio" className="mt-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Portfolio
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Montrez vos réalisations aux clients potentiels
              </p>
            </CardHeader>
            <CardBody>
              <PortfolioUpload />
            </CardBody>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}
