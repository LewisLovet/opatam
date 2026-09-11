/**
 * Éditeur de cadrage — le professionnel déplace la photo au doigt et la
 * zoome à deux doigts dans un cadre EXACTEMENT au format de sa place dans la
 * story (plein cadre 9:16, ou une moitié 9:32 en avant / après).
 *
 * PanResponder plutôt que gesture-handler : aucune racine native à poser,
 * fonctionne tel quel dans une Modal, sur le binaire de développement
 * existant comme en production.
 */

import React, { useMemo, useRef, useState } from 'react';
import { Dimensions, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Text } from '../Text';
import { Cadrage, CADRAGE_DEFAUT, PhotoCadree, ZOOM_MAX, geometriePhoto, useTailleImage } from './PhotoCadree';

interface FramingEditorProps {
  visible: boolean;
  uri: string | null;
  /** Largeur / hauteur de la zone cible dans la story (ex. 9/16 ou 9/32). */
  ratio: number;
  cadrage: Cadrage;
  onClose: () => void;
  onApply: (cadrage: Cadrage) => void;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function FramingEditor({ visible, uri, ratio, cadrage, onClose, onApply }: FramingEditorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const taille = useTailleImage(visible ? uri : null);

  // Le cadre tient dans l'écran : on part de la hauteur disponible.
  const ecran = Dimensions.get('window');
  const hauteur = Math.min(ecran.height * 0.58, 520);
  const largeur = Math.min(hauteur * ratio, ecran.width - 48);
  const cadre = useMemo(
    () => ({ width: Math.round(largeur), height: Math.round(largeur / ratio) }),
    [largeur, ratio],
  );

  const [courant, setCourant] = useState<Cadrage>(cadrage);
  const [ouvertPour, setOuvertPour] = useState<string | null>(null);
  // Réinitialise l'état à chaque ouverture (la Modal reste montée).
  if (visible && ouvertPour !== `${uri}|${cadrage.x}|${cadrage.y}|${cadrage.zoom}`) {
    setOuvertPour(`${uri}|${cadrage.x}|${cadrage.y}|${cadrage.zoom}`);
    setCourant(cadrage);
  }

  const depart = useRef<{ cadrage: Cadrage; distance: number | null }>({ cadrage, distance: null });
  const courantRef = useRef(courant);
  courantRef.current = courant;
  const tailleRef = useRef(taille);
  tailleRef.current = taille;
  const cadreRef = useRef(cadre);
  cadreRef.current = cadre;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Le second doigt ne doit pas rendre le geste à la modale : sans ça
        // le pincement était interrompu dès qu'il commençait.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          depart.current = { cadrage: courantRef.current, distance: null };
        },
        onPanResponderMove: (evt, gesture) => {
          const img = tailleRef.current;
          if (!img) return;
          const touches = evt.nativeEvent.touches;
          if (touches.length >= 2 || gesture.numberActiveTouches >= 2) {
            if (touches.length < 2) return;
            // Pincement : le zoom suit l'écart entre les deux doigts.
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            const distance = Math.hypot(dx, dy);
            if (depart.current.distance === null) {
              depart.current = { cadrage: courantRef.current, distance };
              return;
            }
            const zoom = Math.min(
              ZOOM_MAX,
              Math.max(1, depart.current.cadrage.zoom * (distance / depart.current.distance)),
            );
            setCourant({ ...courantRef.current, zoom });
            return;
          }
          // Retour à un doigt après un pincement : on repart du cadrage courant
          // pour que la photo ne saute pas.
          if (depart.current.distance !== null) {
            depart.current = { cadrage: courantRef.current, distance: null };
            return;
          }
          // Déplacement : la fenêtre glisse sur la photo, en fraction de ce
          // qui dépasse du cadre — la photo suit exactement le doigt.
          const base = depart.current.cadrage;
          const g = geometriePhoto(img, cadreRef.current, base);
          const debordX = g.dw - cadreRef.current.width;
          const debordY = g.dh - cadreRef.current.height;
          setCourant({
            zoom: base.zoom,
            x: debordX > 0 ? clamp01(base.x - gesture.dx / debordX) : 0.5,
            y: debordY > 0 ? clamp01(base.y - gesture.dy / debordY) : 0.5,
          });
        },
        onPanResponderRelease: () => {
          depart.current = { cadrage: courantRef.current, distance: null };
        },
        onPanResponderTerminate: () => {
          depart.current = { cadrage: courantRef.current, distance: null };
        },
      }),
    [],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.card, { backgroundColor: colors.surface }]}>
          <Text style={[s.title, { color: colors.text }]}>{t('storyShare.realisation.frameTitle')}</Text>
          <Text style={[s.hint, { color: colors.textSecondary }]}>{t('storyShare.realisation.frameHint')}</Text>

          <View style={[s.frame, { width: cadre.width, height: cadre.height, borderColor: colors.primary }]}>
            {uri ? (
              <View {...responder.panHandlers} style={StyleSheet.absoluteFill}>
                <PhotoCadree uri={uri} width={cadre.width} height={cadre.height} cadrage={courant} />
              </View>
            ) : null}
            {/* Repères des tiers, comme un appareil photo */}
            <View pointerEvents="none" style={[s.tiers, { left: '33.3%' }]} />
            <View pointerEvents="none" style={[s.tiers, { left: '66.6%' }]} />
            <View pointerEvents="none" style={[s.tiersH, { top: '33.3%' }]} />
            <View pointerEvents="none" style={[s.tiersH, { top: '66.6%' }]} />
          </View>

          {/* Zoom au bouton — fiable partout, en plus du pincement */}
          <View style={s.zoomRow}>
            <Pressable
              onPress={() => setCourant((c) => ({ ...c, zoom: Math.max(1, +(c.zoom - 0.25).toFixed(2)) }))}
              disabled={courant.zoom <= 1}
              style={[s.zoomBtn, { borderColor: colors.border, opacity: courant.zoom <= 1 ? 0.4 : 1 }]}
            >
              <Ionicons name="remove" size={20} color={colors.text} />
            </Pressable>
            <View style={s.zoomTrack}>
              <View style={[s.zoomFill, { width: `${((courant.zoom - 1) / (ZOOM_MAX - 1)) * 100}%`, backgroundColor: colors.primary }]} />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', width: 38, textAlign: 'center' }}>
              {courant.zoom.toFixed(1)}×
            </Text>
            <Pressable
              onPress={() => setCourant((c) => ({ ...c, zoom: Math.min(ZOOM_MAX, +(c.zoom + 0.25).toFixed(2)) }))}
              disabled={courant.zoom >= ZOOM_MAX}
              style={[s.zoomBtn, { borderColor: colors.border, opacity: courant.zoom >= ZOOM_MAX ? 0.4 : 1 }]}
            >
              <Ionicons name="add" size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={s.actions}>
            <Pressable
              onPress={() => setCourant(CADRAGE_DEFAUT)}
              style={[s.secondary, { borderColor: colors.border }]}
            >
              <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                {t('storyShare.realisation.frameReset')}
              </Text>
            </Pressable>
            <Pressable onPress={onClose} style={[s.secondary, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable onPress={() => onApply(courant)} style={[s.primary, { backgroundColor: colors.primary }]}>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{t('storyShare.done')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: { borderRadius: 20, padding: 18, alignItems: 'center', gap: 10, maxWidth: '100%' },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  hint: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  frame: { borderWidth: 2, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000', marginTop: 4 },
  tiers: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  tiersH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, alignSelf: 'stretch' },
  zoomBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  zoomTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(127,127,127,0.25)', overflow: 'hidden' },
  zoomFill: { height: '100%', borderRadius: 3 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
});
