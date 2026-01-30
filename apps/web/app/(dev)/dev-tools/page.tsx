'use client';

import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/Card';
import { Zap, Database, ChevronRight, Info } from 'lucide-react';

interface DevTool {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  status: 'ready' | 'wip';
}

const DEV_TOOLS: DevTool[] = [
  {
    title: 'Test Cloud Functions',
    description: 'Tester les Cloud Functions Firebase : connexion, calcul nextAvailableSlot, recalcul batch.',
    href: '/test-functions',
    icon: <Zap className="w-6 h-6" />,
    status: 'ready',
  },
  {
    title: 'Generateur de donnees',
    description: 'Creer et supprimer des providers de test avec toutes leurs donnees (services, membres, locations).',
    href: '/test-seed',
    icon: <Database className="w-6 h-6" />,
    status: 'ready',
  },
];

export default function DevIndexPage() {
  return (
    <div className="py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Outils de developpement
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Outils internes pour le developpement et le test de l'application Opatam
          </p>
        </div>

        {/* Tools grid */}
        <div className="grid gap-4">
          {DEV_TOOLS.map((tool) => (
            <Link key={tool.href} href={tool.href}>
              <Card className="hover:border-primary-500 dark:hover:border-primary-400 transition-colors cursor-pointer">
                <CardBody className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400 flex-shrink-0">
                    {tool.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {tool.title}
                      </h2>
                      {tool.status === 'wip' && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 rounded">
                          En cours
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {tool.description}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick info */}
        <div className="mt-10 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="font-medium text-blue-900 dark:text-blue-100">
              Acces rapide
            </h3>
          </div>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">/dev-tools</code> - Cette page</li>
            <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">/test-functions</code> - Cloud Functions</li>
            <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">/test-seed</code> - Donnees de test</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
