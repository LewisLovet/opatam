'use client';

interface Props {
  /** Flat 168-element array indexed as [dow * 24 + hour]. */
  heatmap: number[];
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/** Display the standard Mon-Sun order rather than Sun-Sat. */
const DAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function HeatmapPanel({ heatmap }: Props) {
  const max = Math.max(...heatmap, 1);
  const total = heatmap.reduce((s, v) => s + v, 0);

  return (
    <section className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Heatmap activité
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            90 derniers jours · jour × heure
          </p>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {total} RDV
        </span>
      </header>
      {total === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Pas encore assez d'activité pour cette vue.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="text-[10px] sm:text-xs border-separate border-spacing-[2px]">
            <thead>
              <tr>
                <th className="w-8" />
                {Array.from({ length: 24 }, (_, h) => (
                  <th
                    key={h}
                    className="font-normal text-gray-400 dark:text-gray-500 align-bottom pb-1"
                    style={{ width: 18 }}
                  >
                    {h % 3 === 0 ? h : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAY_DISPLAY_ORDER.map((dow) => (
                <tr key={dow}>
                  <td className="text-gray-500 dark:text-gray-400 pr-2 text-right whitespace-nowrap">
                    {DAY_LABELS[dow]}
                  </td>
                  {Array.from({ length: 24 }, (_, h) => {
                    const count = heatmap[dow * 24 + h] ?? 0;
                    const intensity = count / max;
                    return (
                      <td
                        key={h}
                        title={`${DAY_LABELS[dow]} ${h}h — ${count} RDV`}
                        className="rounded-sm transition-transform hover:scale-110"
                        style={{
                          width: 18,
                          height: 18,
                          background:
                            count === 0
                              ? 'var(--heatmap-empty, rgba(0,0,0,0.04))'
                              : `rgba(124, 58, 237, ${0.15 + intensity * 0.85})`,
                        }}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
