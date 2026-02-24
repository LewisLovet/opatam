'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Send, Copy, Check, ExternalLink, Users, Loader2, Calendar, Mail } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '@/components/ui';
import type { Booking, Member, Location } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface TeamSectionProps {
  members: WithId<Member>[];
  locations: WithId<Location>[];
  todayBookings: WithId<Booking>[];
  providerId: string;
}

export function TeamSection({ members, locations, todayBookings, providerId }: TeamSectionProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [recapMember, setRecapMember] = useState<WithId<Member> | null>(null);
  const [sendingRecap, setSendingRecap] = useState(false);
  const [recapResult, setRecapResult] = useState<{ success: boolean; message: string } | null>(null);

  const getLocationName = (locationId: string) => {
    const location = locations.find((l) => l.id === locationId);
    return location?.name || '';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getMemberBookingsCount = (memberId: string) => {
    return todayBookings.filter((b) => b.memberId === memberId).length;
  };

  const handleCopyCode = async (memberId: string, accessCode: string) => {
    try {
      await navigator.clipboard.writeText(accessCode);
      setCopiedId(memberId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      console.error('Failed to copy access code');
    }
  };

  const handleConfirmSendRecap = async () => {
    if (!recapMember) return;
    setSendingRecap(true);
    setRecapResult(null);

    try {
      const res = await fetch('/api/pro/send-agenda-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, memberId: recapMember.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRecapResult({ success: false, message: data.error || 'Erreur lors de l\'envoi' });
        return;
      }

      setRecapResult({ success: true, message: data.message || 'Récap envoyé' });
    } catch {
      setRecapResult({ success: false, message: 'Erreur de connexion' });
    } finally {
      setSendingRecap(false);
    }
  };

  const handleCloseRecapModal = () => {
    setRecapMember(null);
    setRecapResult(null);
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Mon équipe
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
              {members.length}
            </span>
          </div>
          <Link
            href="/pro/activite?tab=equipe"
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
          >
            Gérer l'équipe
          </Link>
        </div>

        {/* Member Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {members.map((member) => {
            const locationName = getLocationName(member.locationId);
            const todayCount = getMemberBookingsCount(member.id);

            return (
              <div
                key={member.id}
                className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 p-3"
              >
                {/* Avatar + Info */}
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold text-white"
                    style={{
                      backgroundColor: member.color || '#6B7280',
                    }}
                  >
                    {member.photoURL ? (
                      <img
                        src={member.photoURL}
                        alt={member.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      getInitials(member.name)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {member.name}
                    </p>
                    {locationName && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {locationName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Today's stats */}
                <div className="flex items-center gap-1.5 mb-3 px-1">
                  <Calendar className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {todayCount === 0
                      ? "Aucun RDV aujourd'hui"
                      : `${todayCount} RDV aujourd'hui`}
                  </span>
                </div>

                {/* Quick Actions with labels */}
                <div className="flex items-stretch gap-1 border-t border-gray-100 dark:border-gray-700 pt-2">
                  {/* Send recap */}
                  <button
                    onClick={() => setRecapMember(member)}
                    className="flex-1 flex flex-col items-center gap-0.5 py-1.5 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                    title={`Envoyer le récap agenda à ${member.name}`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="text-[10px] leading-tight">Récap</span>
                  </button>

                  {/* Copy access code */}
                  <button
                    onClick={() => handleCopyCode(member.id, member.accessCode)}
                    className="flex-1 flex flex-col items-center gap-0.5 py-1.5 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                    title={`Copier le code d'accès : ${member.accessCode}`}
                  >
                    {copiedId === member.id ? (
                      <Check className="w-3.5 h-3.5 text-success-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span className="text-[10px] leading-tight">Code</span>
                  </button>

                  {/* View planning */}
                  <button
                    onClick={() => window.open('/planning', '_blank')}
                    className="flex-1 flex flex-col items-center gap-0.5 py-1.5 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                    title="Voir le planning"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="text-[10px] leading-tight">Planning</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recap Confirmation Modal */}
      <Modal isOpen={!!recapMember} onClose={handleCloseRecapModal}>
        <ModalHeader title="Envoyer le récap agenda" onClose={handleCloseRecapModal} />
        <ModalBody>
          {!recapResult ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Un email récapitulatif de l'agenda de <strong>demain</strong> sera envoyé à :
                  </p>
                </div>
              </div>

              {recapMember && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold text-white"
                    style={{ backgroundColor: recapMember.color || '#6B7280' }}
                  >
                    {getInitials(recapMember.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {recapMember.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {recapMember.email}
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400">
                L'email contiendra son planning personnel, ses rendez-vous et son code d'accès.
              </p>
            </div>
          ) : (
            <div className={`flex items-start gap-3 p-3 rounded-lg ${
              recapResult.success
                ? 'bg-success-50 dark:bg-success-900/20'
                : 'bg-error-50 dark:bg-error-900/20'
            }`}>
              {recapResult.success ? (
                <Check className="w-5 h-5 text-success-600 dark:text-success-400 flex-shrink-0 mt-0.5" />
              ) : (
                <Mail className="w-5 h-5 text-error-600 dark:text-error-400 flex-shrink-0 mt-0.5" />
              )}
              <p className={`text-sm ${
                recapResult.success
                  ? 'text-success-700 dark:text-success-300'
                  : 'text-error-700 dark:text-error-300'
              }`}>
                {recapResult.message}
              </p>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {!recapResult ? (
            <>
              <Button variant="ghost" onClick={handleCloseRecapModal} disabled={sendingRecap}>
                Annuler
              </Button>
              <Button onClick={handleConfirmSendRecap} disabled={sendingRecap}>
                {sendingRecap ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Envoyer
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleCloseRecapModal}>
              Fermer
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </>
  );
}
