/**
 * YouTubeThumbnail
 *
 * Loads `maxresdefault.jpg` (1280×720) from i.ytimg.com first and
 * falls back to `hqdefault.jpg` (480×360) when the maxres URL
 * 404s — most modern uploads have an HD thumbnail, but older /
 * pre-2018 videos sometimes don't. Without this fallback we
 * either ship a broken image or stick to the smaller hq cover
 * and accept the pixelation on Retina screens (the article cards
 * and detail covers render at full screen width × 16:9, which is
 * ~1170px on @3x — 480-wide hqdefault is upscaled 2.4× and looks
 * mushy).
 *
 * Mirrors the web blog component
 * apps/web/app/blog/components/YouTubeThumbnail.tsx so the two
 * surfaces stay visually consistent.
 *
 * Usage: pass the full YouTube URL (or a custom poster URL via
 * `coverUrl`) and the component picks the best source. Style is
 * passed straight to <Image>.
 */

import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { extractYouTubeId } from '@booking-app/shared';

interface Props {
  /** Full YouTube watch / share / embed URL. */
  videoUrl: string | null | undefined;
  /**
   * Optional pre-uploaded cover. When set, takes precedence over
   * the auto-generated YouTube thumb (CMS authors can override).
   */
  coverUrl?: string | null;
  style?: StyleProp<ImageStyle>;
  /** RN <Image resizeMode> — defaults to 'cover' which is what we want. */
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

export function YouTubeThumbnail({
  videoUrl,
  coverUrl,
  style,
  resizeMode = 'cover',
}: Props) {
  const id = React.useMemo(() => extractYouTubeId(videoUrl ?? null), [videoUrl]);
  // Once the maxres URL 404s for this id we remember it across
  // re-renders, otherwise a parent re-render would retry it and
  // briefly flash a broken image again. Keyed on the id so a
  // different video starts fresh.
  const [maxresFailedFor, setMaxresFailedFor] = React.useState<string | null>(
    null,
  );

  // Custom cover wins — give the CMS the final word. If absent,
  // build the YouTube auto-thumb URL (maxres until proven 404).
  const src = React.useMemo(() => {
    if (coverUrl) return coverUrl;
    if (!id) return null;
    return id === maxresFailedFor
      ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
      : `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  }, [coverUrl, id, maxresFailedFor]);

  if (!src) return null;

  return (
    <Image
      source={{ uri: src }}
      style={style}
      resizeMode={resizeMode}
      onError={() => {
        // Only react when we were trying the maxres URL — once we
        // fall back to hqdefault there's nowhere lower to go.
        if (!coverUrl && id && id !== maxresFailedFor) {
          setMaxresFailedFor(id);
        }
      }}
    />
  );
}
