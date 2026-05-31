'use client';

import { useParams } from 'next/navigation';
import { ServiceEditorPage } from '../components/ServiceEditorPage';

export default function EditServicePage() {
  const params = useParams<{ id: string }>();
  return <ServiceEditorPage serviceId={params.id} />;
}
