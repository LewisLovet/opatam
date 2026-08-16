import React from 'react';
import { ThemeProvider } from '../theme';
import { getProviderTheme } from '@booking-app/shared/constants';

/**
 * `'31 31 31'` → `'#1f1f1f'`.
 *
 * Le catalogue est stocké en canaux RVB parce que le web en a besoin — un hex
 * y casserait les modificateurs d'opacité de Tailwind. React Native, lui,
 * attend une couleur CSS classique.
 */
function channelsToHex(channels: string): string {
  return (
    '#' +
    channels
      .split(' ')
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Applique la couleur d'un prestataire à un sous-arbre de l'application.
 *
 * POURQUOI UN SOUS-ARBRE ET NON L'APPLICATION ENTIÈRE :
 * l'app cliente présente des dizaines de prestataires. Repeindre son
 * habillage à chaque fiche consultée désoriente et dissout l'identité
 * Opatam — le client ne sait plus dans quelle application il se trouve.
 * La couleur n'a de sens que là où le salon EST le sujet de l'écran.
 *
 * POURQUOI CE COMPOSANT DOIT ENVELOPPER L'ÉCRAN, ET NON VIVRE DEDANS :
 * un composant ne peut pas consommer le contexte qu'il fournit lui-même. Les
 * quarante `colors.primary` de l'écran prestataire sont dans SON propre JSX ;
 * un fournisseur posé à l'intérieur ne servirait que ses enfants, et l'écran
 * resterait bleu au milieu d'une fiche colorée.
 *
 * Le contexte de thème accepte déjà un `primaryColor` : on l'imbrique plutôt
 * que d'inventer une API.
 *
 * EFFET DE BORD CONNU : un fournisseur imbriqué repart de la configuration
 * par défaut. En production c'est sans conséquence — le fournisseur racine
 * est monté sans config et personne ne la modifie à l'exécution. Mais le
 * `ThemeConfigurator` du DevFAB paraîtra sans effet sur cet écran : ses
 * réglages vivent au-dessus, cet arbre-ci ne les voit pas.
 */
export function ProviderAccent({
  themeId,
  children,
}: {
  themeId?: string | null;
  children: React.ReactNode;
}) {
  const theme = getProviderTheme(themeId);
  // Mêmes crans que le web : 600 pour les aplats, 50 pour les fonds légers,
  // 900 pour les états pressés.
  return (
    <ThemeProvider
      initialConfig={{
        primaryColor: channelsToHex(theme.ramp[6]),
        primaryLightColor: channelsToHex(theme.ramp[0]),
        primaryDarkColor: channelsToHex(theme.ramp[9]),
      }}
    >
      {children}
    </ThemeProvider>
  );
}
