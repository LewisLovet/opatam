'use client';

/**
 * « Accès à l'app » d'un membre — côté gérant, dans sa fiche.
 *
 * Le membre invité reçoit un e-mail (lien valable 7 jours), crée son mot de
 * passe, puis se connecte à l'application : il y voit SON agenda, règle SES
 * horaires et gère SES rendez-vous. Le gérant l'invite, renvoie le lien ou
 * retire l'accès ici ; le membre reste dans l'équipe dans tous les cas.
 *
 * L'état (aucun / invité / lien expiré / actif) suit `etatAccesMembre`, la
 * même règle que l'app mobile.
 */
import { useCallback, useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { CheckCircle2, Clock, Loader2, Mail, Smartphone, UserX } from 'lucide-react';
import { memberAccountRepository } from '@booking-app/firebase';
import { etatAccesMembre, type EtatAccesMembre, type Member } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import { Button, ConfirmDialog, useToast } from '@/components/ui';

const dateCourte = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';

async function appeler(methode: 'POST' | 'DELETE', memberId: string): Promise<{ ok: boolean; error?: string; email?: string }> {
  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new Error('Session expirée, reconnectez-vous');
  const r = await fetch('/api/pro/membres/acces', {
    method: methode,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ memberId }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Une erreur est survenue');
  return data;
}

export function AccesAppMembre({ providerId, member }: { providerId: string; member: WithId<Member> }) {
  const toast = useToast();
  const [etat, setEtat] = useState<EtatAccesMembre | null>(null);
  const [occupe, setOccupe] = useState<'inviter' | 'retirer' | null>(null);
  const [confirmerRetrait, setConfirmerRetrait] = useState(false);

  const charger = useCallback(async () => {
    try {
      const [comptes, invitations] = await Promise.all([
        memberAccountRepository.listByProvider(providerId),
        memberAccountRepository.listInvitationsByProvider(providerId),
      ]);
      setEtat(etatAccesMembre(member.id, comptes, invitations));
    } catch (err) {
      console.error('[AccesAppMembre] lecture', err);
      setEtat({ etat: 'aucun' });
    }
  }, [providerId, member.id]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const inviter = async () => {
    setOccupe('inviter');
    try {
      const r = await appeler('POST', member.id);
      toast.success(`Invitation envoyée à ${r.email}`);
      await charger();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setOccupe(null);
    }
  };

  const retirer = async () => {
    setOccupe('retirer');
    try {
      await appeler('DELETE', member.id);
      toast.success(`${member.name} n'a plus accès à l'application`);
      setConfirmerRetrait(false);
      await charger();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setOccupe(null);
    }
  };

  if (member.isDefault) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Vous êtes le membre principal : vous utilisez déjà l’application avec votre compte.
      </p>
    );
  }
  if (!etat) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  const sansEmail = !member.email?.trim();
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
        Avec son propre accès, {member.name} consulte <strong>son agenda</strong>, règle <strong>ses horaires</strong> et
        gère <strong>ses rendez-vous</strong> depuis l’application Opatam. Les agendas des collègues, vos réglages et
        votre abonnement lui restent invisibles.
      </p>

      {/* État */}
      <div className="flex items-start gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        {etat.etat === 'actif' ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
        ) : etat.etat === 'invite' ? (
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
        ) : etat.etat === 'expire' ? (
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        ) : (
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
        )}
        <div className="min-w-0 text-sm">
          {etat.etat === 'actif' && (
            <>
              <p className="font-semibold text-gray-900 dark:text-white">Accès actif</p>
              <p className="text-gray-600 dark:text-gray-400">
                Connecté avec {etat.email}
                {etat.depuis ? ` depuis le ${dateCourte(etat.depuis)}` : ''}.
              </p>
            </>
          )}
          {etat.etat === 'invite' && (
            <>
              <p className="font-semibold text-gray-900 dark:text-white">Invitation envoyée</p>
              <p className="text-gray-600 dark:text-gray-400">
                À {etat.email}
                {etat.envoyeeLe ? ` le ${dateCourte(etat.envoyeeLe)}` : ''} — lien valable jusqu’au{' '}
                {dateCourte(etat.expireLe)}.
              </p>
            </>
          )}
          {etat.etat === 'expire' && (
            <>
              <p className="font-semibold text-gray-900 dark:text-white">Lien expiré</p>
              <p className="text-gray-600 dark:text-gray-400">
                L’invitation envoyée à {etat.email} n’a pas été utilisée à temps : renvoyez-la.
              </p>
            </>
          )}
          {etat.etat === 'aucun' && (
            <>
              <p className="font-semibold text-gray-900 dark:text-white">Pas d’accès à l’application</p>
              <p className="text-gray-600 dark:text-gray-400">
                {sansEmail
                  ? 'Ajoutez son adresse e-mail dans l’onglet Informations pour pouvoir l’inviter.'
                  : `Une invitation sera envoyée à ${member.email}.`}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {etat.etat !== 'actif' && (
          <Button type="button" size="sm" onClick={inviter} disabled={sansEmail || occupe !== null} loading={occupe === 'inviter'}>
            <Mail className="mr-1.5 h-4 w-4" />
            {etat.etat === 'aucun' ? 'Inviter dans l’application' : 'Renvoyer l’invitation'}
          </Button>
        )}
        {etat.etat !== 'aucun' && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => setConfirmerRetrait(true)}
            disabled={occupe !== null}
          >
            <UserX className="mr-1.5 h-4 w-4" />
            {etat.etat === 'actif' ? 'Retirer l’accès' : 'Annuler l’invitation'}
          </Button>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmerRetrait}
        onClose={() => setConfirmerRetrait(false)}
        onConfirm={retirer}
        title={etat.etat === 'actif' ? 'Retirer l’accès à l’application ?' : 'Annuler l’invitation ?'}
        message={`${member.name} ne pourra plus se connecter à son espace, mais reste dans votre équipe, avec ses horaires et ses rendez-vous.`}
        confirmLabel={etat.etat === 'actif' ? 'Retirer l’accès' : 'Annuler l’invitation'}
        variant="danger"
        loading={occupe === 'retirer'}
      />
    </div>
  );
}
