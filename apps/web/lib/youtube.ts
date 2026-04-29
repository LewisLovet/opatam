/**
 * Extract a YouTube video ID from any common URL shape:
 *  - https://www.youtube.com/watch?v=VIDEO_ID
 *  - https://youtu.be/VIDEO_ID
 *  - https://www.youtube.com/embed/VIDEO_ID
 *  - https://www.youtube.com/shorts/VIDEO_ID
 *  - https://www.youtube.com/live/VIDEO_ID
 */
export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1).split('/')[0] || null;
    }
    if (u.searchParams.has('v')) return u.searchParams.get('v');
    const parts = u.pathname.split('/').filter(Boolean);
    if (['embed', 'shorts', 'v', 'live'].includes(parts[0])) {
      return parts[1] || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns a YouTube auto-generated thumbnail URL for the given video URL,
 * or null if the URL doesn't match.
 *
 * `maxresdefault` is highest quality but doesn't exist for every video.
 * `hqdefault` is the safe fallback that always exists.
 */
export function youtubeThumbnailUrl(
  videoUrl: string | null | undefined,
  quality: 'maxres' | 'hq' = 'maxres'
): string | null {
  const id = extractYouTubeId(videoUrl);
  if (!id) return null;
  const file = quality === 'maxres' ? 'maxresdefault.jpg' : 'hqdefault.jpg';
  return `https://i.ytimg.com/vi/${id}/${file}`;
}
