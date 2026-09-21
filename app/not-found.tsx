import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: t.meta.notFoundTitle };
}

// Replaces Next's built-in 404, which paints its own white body (black under
// a dark OS preference) and so ignored the site's theme — a Dark user landed
// on a white page. This one sits on the same theme tokens as every other page.
export default async function NotFound() {
  const { t } = await getServerT();

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-20">
      <div className="max-w-md text-center space-y-4">
        <p className="text-sm font-semibold tracking-widest text-accent-text">404</p>
        <h1 className="text-3xl font-bold text-ink">{t.notFound.heading}</h1>
        <p className="text-ink-muted">{t.notFound.body}</p>
        <Link
          href="/"
          className="inline-block mt-2 bg-kesri text-navy font-semibold px-5 py-2.5 rounded-lg hover:bg-kesri-hover transition-colors"
        >
          {t.notFound.home}
        </Link>
      </div>
    </main>
  );
}
