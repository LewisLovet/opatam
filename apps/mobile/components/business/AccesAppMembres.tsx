/**
 * Espace membre — côté GÉRANT dans l'app (écran Équipe).
 *
 * - `useAccesMembres` : l'état d'accès de chaque membre (aucun, invité,
 *   lien expiré, actif), selon `etatAccesMembre` — la même règle que le site ;
 * - `ouvrirAccesMembre` : le dialogue d'un membre (inviter, renvoyer,
 *   retirer l'accès), qui appelle `/api/pro/membres/acces` ;
 * - `ReglageCAMembres` : « Les membres voient leur chiffre d'affaires ».
 *
 * Le serveur fait foi (plan Studio, membre actif, adresse e-mail) : ses
 * refus arrivent déjà rédigés et sont montrés tels quels.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memberAccountRepository, providerService } from '@booking-app/firebase';
import { etatAccesMembre, type EtatAccesMembre, type Member } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import i18n from '../../lib/i18n';
import { API_URL } from '../../lib/config';
import { useAuth } from '../../contexts';
import { useTheme } from '../../theme';
import { Card } from '../Card';
import { Text } from '../Text';
import { Switch } from '../Switch';

/** L'état d'accès de chaque membre du salon. Lecture non bloquante. */
export function useAccesMembres(providerId: string | null | undefined) {
  const [etats, setEtats] = useState<Record<string, EtatAccesMembre>>({});
  const recharger = useCallback(async () => {
    if (!providerId) return;
    const [comptes, invitations] = await Promise.all([
      memberAccountRepository.listByProvider(providerId).catch(() => []),
      memberAccountRepository.listInvitationsByProvider(providerId).catch(() => []),
    ]);
    const ids = new Set([...comptes.map((c) => c.memberId), ...invitations.map((i) => i.memberId)]);
    const suivants: Record<string, EtatAccesMembre> = {};
    for (const id of ids) suivants[id] = etatAccesMembre(id, comptes, invitations);
    setEtats(suivants);
  }, [providerId]);
  useEffect(() => {
    void recharger();
  }, [recharger]);
  const etatDe = (memberId: string): EtatAccesMembre => etats[memberId] ?? { etat: 'aucun' };
  return { etatDe, recharger };
}

/** Couleur et icône d'un état, pour le bouton de la fiche. */
export function apparenceAcces(etat: EtatAccesMembre, colors: { primary: string; success?: string; warning?: string; textMuted: string }) {
  switch (etat.etat) {
    case 'actif':
      return { icone: 'phone-portrait' as const, couleur: colors.success ?? '#16A34A' };
    case 'invite':
      return { icone: 'mail-unread-outline' as const, couleur: colors.primary };
    case 'expire':
      return { icone: 'time-outline' as const, couleur: colors.warning ?? '#D97706' };
    default:
      return { icone: 'phone-portrait-outline' as const, couleur: colors.textMuted };
  }
}

const date = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(d) : '';

async function appeler(token: string, methode: 'POST' | 'DELETE', memberId: string) {
  const r = await fetch(`${API_URL}/api/pro/membres/acces`, {
    method: methode,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ memberId }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || i18n.t('common.error'));
  return data as { email?: string };
}

/**
 * L'adresse peut-elle devenir celle d'un membre (son identifiant de
 * connexion) ? Ni un autre compte Opatam, ni un autre membre, ni une
 * adresse déjà invitée ailleurs. Le serveur refait ce contrôle à l'envoi.
 */
export async function verifierEmailMembre(
  getToken: () => Promise<string | undefined>,
  email: string,
  memberId?: string | null,
): Promise<{ disponible: boolean; message?: string }> {
  const token = await getToken();
  if (!token) throw new Error(i18n.t('common.error'));
  const r = await fetch(`${API_URL}/api/pro/membres/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email, memberId: memberId ?? null }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || i18n.t('common.error'));
  return data;
}

/**
 * Envoie (ou renvoie) l'invitation d'un membre, sans dialogue — à la
 * création d'un membre, ou quand son adresse change. Renvoie l'adresse visée.
 */
export async function inviterMembre(getToken: () => Promise<string | undefined>, memberId: string): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error(i18n.t('common.error'));
  const r = await appeler(token, 'POST', memberId);
  return r.email ?? '';
}

/**
 * Le dialogue d'accès d'un membre. `getToken` : le jeton du gérant ;
 * `apres` : recharger l'écran (et afficher un message) une fois fait.
 */
export function ouvrirAccesMembre(
  member: WithId<Member>,
  etat: EtatAccesMembre,
  getToken: () => Promise<string | undefined>,
  apres: (message: string, erreur?: boolean) => void,
) {
  const t = i18n.t.bind(i18n);
  const agir = async (methode: 'POST' | 'DELETE') => {
    try {
      const token = await getToken();
      if (!token) throw new Error(t('common.error'));
      const r = await appeler(token, methode, member.id);
      apres(methode === 'POST' ? t('espaceMembre.gerant.envoyee', { email: r.email ?? '' }) : t('espaceMembre.gerant.retire'));
    } catch (err) {
      apres((err as Error).message, true);
    }
  };
  const confirmerRetrait = () =>
    Alert.alert(t('espaceMembre.gerant.retirerTitre'), t('espaceMembre.gerant.retirerTexte', { name: member.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('espaceMembre.gerant.retirer'), style: 'destructive', onPress: () => agir('DELETE') },
    ]);

  if (etat.etat === 'actif') {
    Alert.alert(t('espaceMembre.gerant.actifTitre', { name: member.name }), t('espaceMembre.gerant.actifTexte', { email: etat.email }), [
      { text: t('common.close'), style: 'cancel' },
      { text: t('espaceMembre.gerant.retirer'), style: 'destructive', onPress: confirmerRetrait },
    ]);
    return;
  }
  if (etat.etat === 'invite' || etat.etat === 'expire') {
    Alert.alert(
      etat.etat === 'invite' ? t('espaceMembre.gerant.inviteTitre') : t('espaceMembre.gerant.expireTitre'),
      etat.etat === 'invite'
        ? t('espaceMembre.gerant.inviteTexte', { email: etat.email, date: date(etat.expireLe) })
        : t('espaceMembre.gerant.expireTexte', { email: etat.email }),
      [
        { text: t('common.close'), style: 'cancel' },
        { text: t('espaceMembre.gerant.annulerInvitation'), style: 'destructive', onPress: () => agir('DELETE') },
        { text: t('espaceMembre.gerant.renvoyer'), onPress: () => agir('POST') },
      ],
    );
    return;
  }
  if (!member.email?.trim()) {
    Alert.alert(t('espaceMembre.gerant.aucunTitre', { name: member.name }), t('espaceMembre.gerant.sansEmail'));
    return;
  }
  Alert.alert(
    t('espaceMembre.gerant.aucunTitre', { name: member.name }),
    t('espaceMembre.gerant.aucunTexte', { email: member.email }),
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('espaceMembre.gerant.inviter'), onPress: () => agir('POST') },
    ],
  );
}

/** Hook pratique : le jeton du gérant connecté. */
export function useJetonGerant() {
  const { user } = useAuth();
  return useCallback(async (): Promise<string | undefined> => user?.getIdToken(), [user]);
}

/** « Les membres voient leur chiffre d'affaires » — choix du gérant. */
export function ReglageCAMembres({
  providerId,
  valeurInitiale,
  onErreur,
}: {
  providerId: string;
  valeurInitiale: boolean;
  onErreur: () => void;
}) {
  const { colors, spacing } = useTheme();
  const [voirCA, setVoirCA] = useState(valeurInitiale);
  const [occupe, setOccupe] = useState(false);
  useEffect(() => setVoirCA(valeurInitiale), [valeurInitiale]);

  const basculer = async (valeur: boolean) => {
    setVoirCA(valeur);
    setOccupe(true);
    try {
      await providerService.updateSettings(providerId, { memberRevenueVisible: valeur });
    } catch {
      setVoirCA(!valeur);
      onErreur();
    } finally {
      setOccupe(false);
    }
  };

  return (
    <Card padding="lg" shadow="sm" style={{ marginTop: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <Ionicons name="phone-portrait-outline" size={18} color={colors.primary} />
        <Text variant="body" style={{ fontWeight: '600' }}>{i18n.t('espaceMembre.gerant.carteTitre')}</Text>
      </View>
      <Text variant="caption" color="textSecondary" style={{ marginBottom: spacing.md }}>
        {i18n.t('espaceMembre.gerant.carteTexte')}
      </Text>
      <Switch
        value={voirCA}
        onValueChange={basculer}
        disabled={occupe}
        label={i18n.t('espaceMembre.gerant.voirCA')}
        description={i18n.t('espaceMembre.gerant.voirCAAide')}
      />
    </Card>
  );
}
