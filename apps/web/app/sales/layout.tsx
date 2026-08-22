'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Loader } from '@/components/ui';

interface StaffInfo {
  role: 'sales' | 'sales_manager';
  displayName: string;
  active: boolean;
}

/**
 * Garde de l'espace commercial.
 *
 * Le rôle vit dans `staffMembers/{uid}` — les règles Firestore n'autorisent
 * que la lecture de SA PROPRE fiche, et aucune écriture client. Un compte
 * sans fiche active est renvoyé à l'accueil ; un admin passe (il gère
 * l'équipe, il voit ce qu'elle voit).
 *
 * Ce layout ne fait QUE la garde et le squelette : chaque donnée métier
 * transite par les routes serveur (`requireStaff`), jamais par le SDK.
 */
export default function SalesLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [staff, setStaff] = useState<StaffInfo | null | 'refuse'>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?redirect=/sales');
      return;
    }
    if (user.isAdmin) {
      setStaff({ role: 'sales_manager', displayName: user.displayName ?? 'Admin', active: true });
      return;
    }
    getDoc(doc(getFirestore(), 'staffMembers', user.id))
      .then((snap) => {
        const d = snap.data() as StaffInfo | undefined;
        if (snap.exists() && d?.active) setStaff(d);
        else setStaff('refuse');
      })
      .catch(() => setStaff('refuse'));
  }, [user, loading, router]);

  useEffect(() => {
    if (staff === 'refuse') router.replace('/');
  }, [staff, router]);

  if (loading || staff === null || staff === 'refuse') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-gray-950 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold">Opatam</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 font-semibold uppercase tracking-wide">
            Espace commercial
          </span>
        </div>
        <div className="text-sm text-gray-400">
          {staff.displayName}
          {staff.role === 'sales_manager' && <span className="ml-2 text-xs text-amber-400">manager</span>}
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-6">{children}</main>
    </div>
  );
}
