import { getServerT } from '@/lib/i18n/server';

// Shown while the page waits for GurbaniNow, so the navbar and the shape of
// the page arrive at once instead of a blank wait. It is the page's own
// layout, drawn in placeholder bars.
export default async function HukamnamaLoading() {
  const { t } = await getServerT();

  return (
    <main className="flex-1 flex flex-col" aria-busy="true">
      <div className="flex-grow max-w-4xl mx-auto w-full p-4 md:p-8">
        <h1 className="sr-only">{t.hukamnama.title}</h1>

        <div className="flex flex-col items-end gap-2 mb-4" aria-hidden="true">
          <span className="h-3 w-28 rounded bg-edge animate-pulse" />
          <span className="h-3 w-36 rounded bg-edge/60 animate-pulse" />
        </div>

        <div className="bg-surface-raised shadow-2xl rounded-2xl overflow-hidden border-t-8 border-kesri" aria-hidden="true">
          <div className="bg-surface p-8 flex flex-col items-center gap-3 border-b border-edge">
            <span className="h-7 w-40 rounded bg-edge animate-pulse" />
            <span className="h-3 w-16 rounded bg-edge/60 animate-pulse" />
          </div>
          <div className="p-6 md:p-12 space-y-10">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-4">
                <span className="h-8 w-11/12 max-w-2xl rounded bg-edge animate-pulse" />
                <span className="h-5 w-3/4 max-w-xl rounded bg-edge/60 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
