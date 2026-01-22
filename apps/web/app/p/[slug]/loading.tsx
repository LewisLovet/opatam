export default function ProviderLoading() {
  return (
    <div className="animate-pulse">
      {/* Cover Photo Skeleton */}
      <div className="h-48 md:h-64 bg-gray-200 dark:bg-gray-800" />

      {/* Header Skeleton */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-12 sm:-mt-16 pb-4 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
            {/* Avatar Skeleton */}
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-gray-300 dark:bg-gray-700 border-4 border-white dark:border-gray-900" />

            {/* Info Skeleton */}
            <div className="flex-1 space-y-3">
              <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-48" />
              <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-24" />
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-32" />
            </div>
          </div>
        </div>

        {/* Navigation Skeleton */}
        <div className="sticky top-0 z-10 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 mt-4">
          <div className="flex gap-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-24" />
            <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-24" />
            <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-24" />
            <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-24" />
          </div>
        </div>

        {/* Services Section Skeleton */}
        <div className="py-8 space-y-4">
          <div className="h-7 bg-gray-300 dark:bg-gray-700 rounded w-32" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-40" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-64" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-20" />
                  </div>
                  <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* About Section Skeleton */}
        <div className="py-8 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <div className="h-7 bg-gray-300 dark:bg-gray-700 rounded w-24" />
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
          </div>
        </div>

        {/* Reviews Section Skeleton */}
        <div className="py-8 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <div className="h-7 bg-gray-300 dark:bg-gray-700 rounded w-20" />
          <div className="flex items-center gap-4">
            <div className="h-12 bg-gray-300 dark:bg-gray-700 rounded w-16" />
            <div className="space-y-2 flex-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-2 bg-gray-200 dark:bg-gray-800 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Booking Bar Skeleton */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 md:hidden">
        <div className="flex items-center justify-between">
          <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-24" />
          <div className="h-10 bg-primary-500 rounded-lg w-28" />
        </div>
      </div>
    </div>
  );
}
