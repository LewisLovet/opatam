'use client';

import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useEditorData } from './useEditorData';
import { ServiceEditor } from './ServiceEditor';

const BACK_HREF = '/pro/activite?tab=prestations';

/**
 * Loading / not-found gate around the editor. Used by both the create
 * (`/prestations/nouvelle`) and edit (`/prestations/[id]`) routes.
 */
export function ServiceEditorPage({ serviceId }: { serviceId?: string }) {
  const data = useEditorData(serviceId);

  if (data.loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (data.notFound || !data.providerId) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-4">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          Prestation introuvable
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Cette prestation n&apos;existe plus ou a été supprimée.
        </p>
        <Link
          href={BACK_HREF}
          className="inline-flex items-center gap-2 mt-6 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux prestations
        </Link>
      </div>
    );
  }

  return (
    <ServiceEditor
      providerId={data.providerId}
      service={data.service}
      locations={data.locations}
      members={data.members}
      categories={data.categories}
      isTeamPlan={data.isTeamPlan}
      depositsEnabled={data.depositsEnabled}
      defaultDeposit={data.defaultDeposit}
    />
  );
}
