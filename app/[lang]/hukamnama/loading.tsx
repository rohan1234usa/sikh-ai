import { getServerT } from '@/lib/i18n/server';

// Shown while the page waits for GurbaniNow, so the navbar and the shape of
// the page arrive at once instead of a blank wait. It is the page's own
// layout, drawn in placeholder bars: the dawn head (HukamnamaHeader), then
// lines of three, as the Hukamnama's are.
export default async function HukamnamaLoading() {
  const { t } = await getServerT();

  return (
    <main className="flex-1 flex flex-col" aria-busy="true">
      <div className="flex-grow max-w-4xl mx-auto w-full p-4 md:p-8">
        <h1 className="sr-only">{t.hukamnama.title}</h1>

        <div aria-hidden="true">
          <div className="dawn flex flex-col items-center gap-3 border-b border-rule-gold px-6 py-8">
            <span className="h-3 w-36 rounded bg-edge animate-pulse" />
            <span className="h-3 w-48 rounded bg-edge/60 animate-pulse" />
            <span className="mt-3 h-7 w-40 rounded bg-edge animate-pulse" />
            <span className="h-3 w-32 rounded bg-edge/60 animate-pulse" />
          </div>
          <div className="space-y-10 px-2 py-10 md:px-10">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <span className="h-8 w-11/12 max-w-2xl rounded bg-edge animate-pulse" />
                <span className="h-4 w-2/3 max-w-lg rounded bg-edge/60 animate-pulse" />
                <span className="h-5 w-3/4 max-w-xl rounded bg-edge/60 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
