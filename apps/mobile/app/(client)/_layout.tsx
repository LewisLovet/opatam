/**
 * Client Layout
 * Main layout for client-facing screens with tab navigation
 */

import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../theme';
import { useAuth } from '../../contexts';
import { setPendingRoute } from '../../lib/pendingRoute';

export default function ClientLayout() {
  const { colors } = useTheme();
  const { isAuthenticated, isLoading, userData } = useAuth();
  const pathname = usePathname();

  // Garde d'authentification ET de rôle pour TOUT l'espace client.
  // `app/index.tsx` envoyait déjà les visiteurs déconnectés vers la
  // connexion, mais rien ne protégeait le groupe lui-même : n'importe quel
  // push pouvait ouvrir un écran client sans compte. Décision produit : on
  // ne parcourt pas l'app sans être connecté.
  //
  // La destination est mise de côté avant de rediriger — la garde de
  // `(auth)/_layout` y ramène dès que le compte est authentifié, pour que
  // l'utilisateur atterrisse bien sur la page qu'il avait demandée.
  // On attend `userData` : c'est le rôle qui décide de l'espace.
  if (isLoading || (isAuthenticated && !userData)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  // Les rôles sont exclusifs : un compte pro n'a rien à faire dans
  // l'espace client, quel que soit le chemin emprunté pour y arriver.
  //
  // UNE exception : la fiche publique d'un prestataire. C'est la cible du
  // bouton « Voir ma page » de l'accueil pro, qui ouvre sa propre fiche en
  // aperçu — la garde la renvoyait vers l'accueil, rendant l'aperçu
  // inatteignable. Cette page est publique et en lecture seule : la laisser
  // s'afficher n'ouvre aucun accès à l'espace client, les écrans suivants
  // (réservation, profil…) restant protégés.
  const isPublicProviderPage = pathname?.startsWith('/provider/') ?? false;
  if (isAuthenticated && userData?.role === 'provider' && !isPublicProviderPage) {
    return <Redirect href={'/(pro)' as never} />;
  }
  if (!isAuthenticated) {
    if (pathname && pathname !== '/') setPendingRoute(pathname);
    // L'écran d'accueil auth, pas le formulaire de connexion : celui qui
    // arrive ici par un lien n'a souvent PAS encore de compte (téléchargement
    // sans inscription finie, réinstallation). Il y trouve les deux chemins,
    // et la reprise fonctionne aussi bien après une inscription qu'après une
    // connexion (la garde (auth) réagit à l'authentification, pas au moyen).
    return <Redirect href="/(auth)" />;
  }

  return (
    <>
    <StatusBar style="light" />
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="provider/[slug]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="edit-profile"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="booking/[providerId]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="booking-detail/[bookingId]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="review/[bookingId]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="notification-settings"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="loyalty"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
    </>
  );
}
