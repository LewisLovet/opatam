import React from 'react';

/**
 * Garde-fou autour de la modale de story : elle charge des modules natifs
 * (capture d'écran, partage) qui peuvent manquer sur certains appareils.
 * Une erreur au chargement ne fait pas tomber l'écran hôte — la modale
 * n'apparaît pas, c'est tout. `resetKey` (l'ouverture) permet de réessayer.
 *
 * Même garde que celle de l'accueil pro ; extraite ici pour être réutilisée
 * depuis la liste des rendez-vous.
 */
export class NativeModuleBoundary extends React.Component<
  { children: React.ReactNode; resetKey?: unknown },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.warn('[NativeModuleBoundary] Caught error:', error.message);
  }
  componentDidUpdate(prevProps: { resetKey?: unknown }) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}
