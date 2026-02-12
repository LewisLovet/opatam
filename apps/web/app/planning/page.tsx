'use client';

import { useState, useEffect } from 'react';
import { PlanningLogin } from './components/PlanningLogin';
import { PlanningView } from './components/PlanningView';

const SESSION_KEY = 'opatam-planning-session';

interface PlanningSession {
  memberId: string;
  providerId: string;
  memberName: string;
  accessCode: string;
}

export default function PlanningPage() {
  const [session, setSession] = useState<PlanningSession | null>(null);
  const [ready, setReady] = useState(false);

  // Restore session from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        setSession(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
    setReady(true);
  }, []);

  const handleAuthenticated = (data: PlanningSession) => {
    setSession(data);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  };

  const handleLogout = () => {
    setSession(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  // Avoid flash of login form while checking sessionStorage
  if (!ready) return null;

  if (!session) {
    return <PlanningLogin onAuthenticated={handleAuthenticated} />;
  }

  return (
    <PlanningView
      accessCode={session.accessCode}
      memberName={session.memberName}
      onLogout={handleLogout}
    />
  );
}
