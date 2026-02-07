'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardBody, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import {
  User,
  Image,
  Share2,
  Globe,
  Eye,
} from 'lucide-react';
import {
  ProfileForm,
  PhotoUpload,
  CoverPhotoUpload,
  PortfolioUpload,
  SocialLinksForm,
  PublicationSection,
} from './components';

const TAB_IDS = ['infos', 'photos', 'reseaux', 'publication'] as const;

export default function ProfilPage() {
  const { provider } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    TAB_IDS.includes(tabFromUrl as typeof TAB_IDS[number]) ? tabFromUrl! : 'infos'
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
    { id: 'infos', label: 'Infos', icon: <User className="w-4 h-4" /> },
    { id: 'photos', label: 'Photos', icon: <Image className="w-4 h-4" /> },
    { id: 'reseaux', label: 'Reseaux', icon: <Share2 className="w-4 h-4" /> },
    { id: 'publication', label: 'Visibilite', icon: <Globe className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 min-w-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Profil public
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Gérez les informations visibles par vos clients
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="infos" value={activeTab} onValueChange={handleTabChange}>
        {/* Tab List */}
        <TabsList className="w-fit">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Infos Tab */}
        <TabsContent value="infos" className="mt-6">
          <div className="grid lg:grid-cols-3 gap-6 min-w-0">
            {/* Main Form */}
            <div className="lg:col-span-2 min-w-0">
              <Card className="min-w-0 overflow-hidden">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Informations generales
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Ces informations seront visibles sur votre page publique
                  </p>
                </CardHeader>
                <CardBody>
                  <ProfileForm />
                </CardBody>
              </Card>
            </div>

            {/* Profile Photo */}
            <div>
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Photo de profil
                  </h2>
                </CardHeader>
                <CardBody>
                  <PhotoUpload />
                </CardBody>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Photos Tab */}
        <TabsContent value="photos" className="mt-6 space-y-6">
          {/* Cover Photo */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Photo de couverture
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Image affichee en banniere sur votre page publique
              </p>
            </CardHeader>
            <CardBody>
              <CoverPhotoUpload />
            </CardBody>
          </Card>

          {/* Portfolio */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Portfolio
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Montrez vos realisations aux clients potentiels
              </p>
            </CardHeader>
            <CardBody>
              <PortfolioUpload />
            </CardBody>
          </Card>
        </TabsContent>

        {/* Social Links Tab */}
        <TabsContent value="reseaux" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Reseaux sociaux
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ajoutez vos liens pour permettre aux clients de vous suivre
              </p>
            </CardHeader>
            <CardBody>
              <SocialLinksForm />
            </CardBody>
          </Card>
        </TabsContent>

        {/* Visibilite Tab */}
        <TabsContent value="publication" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Visibilite
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Controlez la visibilite de votre page
              </p>
            </CardHeader>
            <CardBody>
              <PublicationSection />
            </CardBody>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Link */}
      {provider?.slug && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-10">
          <a
            href={`/p/${provider.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-full shadow-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Apercu</span>
          </a>
        </div>
      )}
    </div>
  );
}
