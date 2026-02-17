/**
 * PortfolioGallery Component
 * Displays a grid of portfolio photos with a full-screen lightbox viewer
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';

export interface PortfolioGalleryProps {
  photos: string[];
}

const { width: screenWidth } = Dimensions.get('window');
const GAP = 4;
const GRID_COLUMNS = 3;
const MAX_VISIBLE = 6;
const PADDING = 16;
const itemSize =
  (screenWidth - PADDING * 2 - GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

export function PortfolioGallery({ photos }: PortfolioGalleryProps) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<string>>(null);

  const openLightbox = useCallback((index: number) => {
    setCurrentIndex(index);
    setLightboxVisible(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxVisible(false);
  }, []);

  const onMomentumScrollEnd = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      const newIndex = Math.round(
        event.nativeEvent.contentOffset.x / screenWidth
      );
      setCurrentIndex(newIndex);
    },
    []
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: screenWidth,
      offset: screenWidth * index,
      index,
    }),
    []
  );

  if (photos.length === 0) {
    return null;
  }

  const visiblePhotos = photos.slice(0, MAX_VISIBLE);
  const extraCount = photos.length - (MAX_VISIBLE - 1);
  const hasOverflow = photos.length > MAX_VISIBLE;

  const renderGridItem = ({
    item,
    index,
  }: {
    item: string;
    index: number;
  }) => {
    const isLastVisible = index === MAX_VISIBLE - 1 && hasOverflow;
    const lightboxIndex = isLastVisible ? MAX_VISIBLE - 1 : index;

    return (
      <Pressable
        onPress={() => openLightbox(lightboxIndex)}
        style={({ pressed }) => [
          styles.gridItem,
          {
            width: itemSize,
            borderRadius: radius.md,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Image
          source={{ uri: item }}
          style={[styles.gridImage, { borderRadius: radius.md }]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        {isLastVisible && (
          <View style={[styles.overlay, { borderRadius: radius.md }]}>
            <Text variant="body" style={styles.overlayText}>
              +{extraCount}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  const renderLightboxItem = ({ item }: { item: string }) => (
    <View style={[styles.lightboxSlide, { width: screenWidth }]}>
      <Image
        source={{ uri: item }}
        style={styles.lightboxImage}
        contentFit="contain"
        cachePolicy="memory-disk"
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={visiblePhotos}
        renderItem={renderGridItem}
        keyExtractor={(item, index) => `portfolio-${index}`}
        numColumns={GRID_COLUMNS}
        scrollEnabled={false}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ gap: GAP }}
      />

      <Modal
        visible={lightboxVisible}
        animationType="fade"
        transparent={false}
        statusBarTranslucent
        onRequestClose={closeLightbox}
      >
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.lightboxContainer}>
          <FlatList
            ref={flatListRef}
            data={photos}
            renderItem={renderLightboxItem}
            keyExtractor={(item, index) => `lightbox-${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={currentIndex}
            getItemLayout={getItemLayout}
            onMomentumScrollEnd={onMomentumScrollEnd}
          />

          {/* Close button */}
          <Pressable
            onPress={closeLightbox}
            style={[
              styles.closeButton,
              {
                top: insets.top + spacing.sm,
                right: spacing.lg,
              },
            ]}
            hitSlop={12}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>

          {/* Counter */}
          <View
            style={[
              styles.counter,
              {
                bottom: insets.bottom + spacing.lg,
              },
            ]}
          >
            <Text variant="body" style={styles.counterText}>
              {currentIndex + 1} / {photos.length}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  gridItem: {
    aspectRatio: 1,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  lightboxContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  lightboxSlide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counter: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  counterText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
