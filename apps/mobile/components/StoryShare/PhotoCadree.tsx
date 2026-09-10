/**
 * Une photo posée dans un cadre aux dimensions connues, avec un cadrage
 * choisi par le professionnel : position (x, y) et zoom.
 *
 * Pourquoi pas `resizeMode="cover"` : il centre toujours, et sur iOS le
 * recadrage natif du sélecteur est carré quoi qu'on demande — dans une
 * moitié de story (9:32) la largeur était coupée à l'aveugle. Ici la photo
 * couvre le cadre au minimum (jamais de bande vide), puis se déplace et se
 * zoome selon le cadrage.
 *
 * Utilisé par la story (capture) ET par l'éditeur de cadrage : même calcul,
 * donc ce qu'on voit en réglant est exactement ce qui sera publié.
 */

import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

export interface Cadrage {
  /** Position horizontale de la fenêtre sur la photo, 0 = bord gauche, 1 = bord droit. */
  x: number;
  /** Position verticale, 0 = haut, 1 = bas. */
  y: number;
  /** 1 = la photo couvre juste le cadre ; 3 = trois fois plus près. */
  zoom: number;
}

export const CADRAGE_DEFAUT: Cadrage = { x: 0.5, y: 0.5, zoom: 1 };
export const ZOOM_MAX = 3;

export interface PhotoGeometrie {
  /** Taille affichée de la photo. */
  dw: number;
  dh: number;
  /** Décalage du coin haut-gauche de la photo dans le cadre (≤ 0). */
  left: number;
  top: number;
}

/** Le calcul partagé : où se place la photo dans un cadre donné. */
export function geometriePhoto(
  image: { width: number; height: number },
  cadre: { width: number; height: number },
  cadrage: Cadrage,
): PhotoGeometrie {
  const couverture = Math.max(cadre.width / image.width, cadre.height / image.height);
  const s = couverture * Math.min(ZOOM_MAX, Math.max(1, cadrage.zoom));
  const dw = image.width * s;
  const dh = image.height * s;
  const x = Math.min(1, Math.max(0, cadrage.x));
  const y = Math.min(1, Math.max(0, cadrage.y));
  return {
    dw,
    dh,
    left: -(dw - cadre.width) * x,
    top: -(dh - cadre.height) * y,
  };
}

const tailles = new Map<string, { width: number; height: number }>();

/** Dimensions naturelles d'une image, mises en cache par URI. */
export function useTailleImage(uri: string | null) {
  const [taille, setTaille] = useState<{ width: number; height: number } | null>(
    uri ? tailles.get(uri) ?? null : null,
  );
  useEffect(() => {
    if (!uri) {
      setTaille(null);
      return;
    }
    const connue = tailles.get(uri);
    if (connue) {
      setTaille(connue);
      return;
    }
    let actif = true;
    Image.getSize(
      uri,
      (width, height) => {
        tailles.set(uri, { width, height });
        if (actif) setTaille({ width, height });
      },
      () => {
        if (actif) setTaille(null);
      },
    );
    return () => {
      actif = false;
    };
  }, [uri]);
  return taille;
}

interface PhotoCadreeProps {
  uri: string;
  width: number;
  height: number;
  cadrage: Cadrage;
}

export function PhotoCadree({ uri, width, height, cadrage }: PhotoCadreeProps) {
  const taille = useTailleImage(uri);
  if (!taille) {
    // En attendant les dimensions : couverture centrée, jamais un trou.
    return <Image source={{ uri }} style={{ width, height }} resizeMode="cover" />;
  }
  const g = geometriePhoto(taille, { width, height }, cadrage);
  return (
    <View style={[{ width, height }, s.clip]}>
      <Image
        source={{ uri }}
        style={{ position: 'absolute', left: g.left, top: g.top, width: g.dw, height: g.dh }}
        resizeMode="stretch"
      />
    </View>
  );
}

const s = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
