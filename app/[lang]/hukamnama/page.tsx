import type { Metadata } from 'next';
import Link from 'next/link';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { PRIMARY_BUTTON } from '@/app/components/buttons';
import HukamnamaHeader from '@/app/components/gurbani/HukamnamaHeader';
import Tukk from '@/app/components/gurbani/Tukk';
import SourceNote from '@/app/components/shabad/SourceNote';
import { fetchHukamnama } from '@/lib/gurbani/gurbaninow';
import { localePath } from '@/lib/i18n/paths';
import { getServerT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  return pageMetadata(lang, t, '/hukamnama', t.meta.hukamnamaTitle, t.meta.descriptions.hukamnama);
}

export default async function HukamnamaPage() {
  const { lang, t } = await getServerT();

  // Cached for ten minutes and cut off after a few seconds (see
  // lib/gurbani/gurbaninow.ts); loading.tsx shows meanwhile. null, when
  // GurbaniNow is slow or down or sends nothing to show, becomes the message
  // below.
  const hukamnama = await fetchHukamnama();

  return (
    <main className="flex-1 flex flex-col">
      <div className="flex-grow max-w-4xl mx-auto w-full p-4 md:p-8">
        {!hukamnama ? (
          <>
            <h1 className="sr-only">{t.hukamnama.title}</h1>
            <div className="mt-20 border border-edge bg-surface-raised p-8 text-center">
              <p className="text-ink">{t.hukamnama.unable}</p>
            </div>
          </>
        ) : (
          <article>
            <HukamnamaHeader hukamnama={hukamnama} lang={lang} t={t} level="h1" />

            {/* The whole Hukamnama, each line as GurbaniNow gives it: the
                heading above it smaller, every verse with its transliteration
                and translation. */}
            <div className="space-y-10 px-2 py-10 md:px-10">
              {hukamnama.lines.map((line) => (
                <Tukk
                  key={line.id}
                  kind={line.kind}
                  size="display"
                  gurmukhi={line.gurmukhi}
                  transliteration={line.transliteration}
                  translation={line.translation}
                />
              ))}
            </div>

            <footer className="space-y-6 border-t border-edge pt-8 text-center">
              <Link href={localePath(lang, '/chat?context=hukamnama')} className={PRIMARY_BUTTON}>
                <ChatBubbleLeftRightIcon className="w-5 h-5" aria-hidden="true" />
                {t.hukamnama.discussCta}
              </Link>
              <SourceNote t={t} />
            </footer>
          </article>
        )}
      </div>
    </main>
  );
}
