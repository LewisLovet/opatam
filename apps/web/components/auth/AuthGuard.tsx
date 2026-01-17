'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  requireProvider?: boolean;
}

export function AuthGuard({ children, requireProvider = true }: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated, hasCompletedOnboarding, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    // Not authenticated -> redirect to login
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    // Authenticated but no provider setup (for /pro routes)
    if (requireProvider && !hasCompletedOnboarding) {
      router.replace('/register');
      return;
    }
  }, [isAuthenticated, hasCompletedOnboarding, loading, requireProvider, router]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  // Not authenticated or needs onboarding - render nothing while redirecting
  if (!isAuthenticated || (requireProvider && !hasCompletedOnboarding)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">Redirection...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
