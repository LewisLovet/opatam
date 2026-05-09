/**
 * Re-export YouTube helpers from shared so both web (`/blog`) and
 * mobile (in-app tutoriels) read the same logic. Existing web
 * imports of `@/lib/youtube` keep working unchanged.
 */
export {
  extractYouTubeId,
  youtubeThumbnailUrl,
} from '@booking-app/shared';
