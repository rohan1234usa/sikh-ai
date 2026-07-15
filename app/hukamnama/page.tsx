import type { Metadata } from 'next';
import Link from 'next/link';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

export const metadata: Metadata = {
  title: "Today's Hukamnama",
};

// Fields are typed optional because GurbaniNow can return HTTP 200 with a
// drifted/partial shape; the render below tolerates missing pieces rather
// than throwing past the try/catch into an error page.
type HukamnamaLine = {
  line?: {
    id?: string;
    gurmukhi?: { unicode?: string };
    translation?: { english?: { default?: string } };
  };
};

type HukamnamaResponse = {
  date?: {
    nanakshahi?: {
      english?: { date?: number; month?: string; year?: number };
    };
  };
  hukamnamainfo?: {
    raag?: { unicode?: string };
    pageno?: number;
  };
  hukamnama?: HukamnamaLine[];
};

async function getHukamnama() {
  const res = await fetch('https://api.gurbaninow.com/v2/hukamnama/today', {
    cache: 'no-store'
  });

  if (!res.ok) throw new Error('Failed to fetch');

  return res.json() as Promise<HukamnamaResponse>;
}

export default async function HukamnamaPage() {
  let data: HukamnamaResponse | null = null;
  let error = false;

  try {
    data = await getHukamnama();
  } catch {
    error = true;
  }

  const dateInfo = data?.date?.nanakshahi?.english;
  const dateString =
    dateInfo?.month && dateInfo.date != null && dateInfo.year != null
      ? `${dateInfo.month} ${dateInfo.date}, ${dateInfo.year}`
      : "Today";

  // Only the lines that actually carry Gurmukhi; a drifted payload yields an
  // empty list, which flips us to the friendly fallback below.
  const lines = (data?.hukamnama ?? []).filter((item) => item?.line?.gurmukhi?.unicode);
  const hasContent = !error && !!data && lines.length > 0;
  const pageno = data?.hukamnamainfo?.pageno;

  return (
    <main className="flex-1 flex flex-col">
      <div className="flex-grow max-w-4xl mx-auto w-full p-4 md:p-8">

        <h1 className="sr-only">Today&apos;s Hukamnama</h1>

        <div className="text-right mb-4">
          <span className="block text-accent-text tracking-widest uppercase text-xs font-bold">
            {dateString}
          </span>
          <span className="text-xs text-ink-faint">Live from Darbar Sahib</span>
        </div>

        {!hasContent ? (
           <div className="text-center mt-20 p-8 bg-surface-raised rounded-xl border border-edge shadow-sm">
             <p className="text-ink">Unable to load the Hukamnama right now.</p>
           </div>
        ) : (
          <div className="bg-surface-raised shadow-2xl rounded-2xl overflow-hidden border-t-8 border-kesri">

            <div className="bg-surface p-8 text-center border-b border-edge">
              <h2 lang="pa" className="text-3xl text-ink font-gurmukhi font-bold mb-2">
                {data?.hukamnamainfo?.raag?.unicode}
              </h2>
              {pageno != null && (
                <p className="text-ink-muted text-sm uppercase tracking-wider font-bold">
                  Ang {pageno}
                </p>
              )}
            </div>

            <div className="p-6 md:p-12 space-y-10">
              {lines.map((item, index) => (
                <div key={item.line?.id ?? index} className="text-center space-y-4">

                  {/* Main Shabad Lines */}
                  <p lang="pa" className="text-2xl md:text-4xl text-ink font-bold leading-relaxed font-gurmukhi">
                    {item.line?.gurmukhi?.unicode}
                  </p>

                  {/* Translation */}
                  <p className="text-ink-muted text-lg md:text-xl italic font-medium">
                    {item.line?.translation?.english?.default}
                  </p>

                  <div className="w-16 h-px bg-edge mx-auto mt-6"></div>
                </div>
              ))}
            </div>

            <div className="p-6 md:px-12 md:pb-10 pt-0 flex justify-center border-t border-edge bg-surface">
              <Link
                href="/chat?context=hukamnama"
                className="inline-flex items-center gap-2 bg-kesri text-navy font-bold px-6 py-3 mt-6 rounded-xl hover:opacity-90 transition-opacity"
              >
                <ChatBubbleLeftRightIcon className="w-5 h-5" aria-hidden="true" />
                Discuss today&apos;s Hukamnama with SikhAI
              </Link>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}
