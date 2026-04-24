/**
 * Minimal branding footer — shown in every state of the embed widget.
 * Links to opatam.com in a new tab so the pro's site isn't replaced.
 */
export function EmbedFooter() {
  return (
    <div className="pt-4 pb-3 flex items-center justify-center border-t border-gray-100 dark:border-gray-800 mt-6">
      <a
        href="https://opatam.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors inline-flex items-center gap-1"
      >
        Réservation propulsée par{' '}
        <span className="font-semibold text-gray-500 dark:text-gray-400">Opatam</span>
      </a>
    </div>
  );
}
