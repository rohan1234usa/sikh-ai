import type { Metadata } from 'next';
import Link from 'next/link';
import { localePath } from '@/lib/i18n/paths';
import { getServerT } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/metadata';

// What the site keeps, where, for how long, what it sends to other services,
// and how to remove it (#19). The words live in the dictionaries (privacy),
// so all three languages say the same thing; the owner signs off on them.
export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getServerT();
  return pageMetadata(lang, t, '/privacy', t.privacy.title, t.privacy.intro);
}

export default async function PrivacyPage() {
  const { lang, t } = await getServerT();
  return (
    <main className="flex-1 px-4 py-12">
      <article className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold text-ink">{t.privacy.title}</h1>
          <p className="text-sm text-ink-muted">{t.privacy.updated}</p>
          <p className="text-ink leading-relaxed">{t.privacy.intro}</p>
        </header>
        {t.privacy.sections.map((section) => (
          <section key={section.heading} className="space-y-3">
            <h2 className="text-xl font-bold text-ink">{section.heading}</h2>
            <ul className="list-disc pl-5 space-y-2 text-ink leading-relaxed">
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ))}
        <p>
          <Link href={localePath(lang, '/about')} className="text-sm font-semibold text-accent-text hover:underline">
            {t.meta.aboutTitle} →
          </Link>
        </p>
      </article>
    </main>
  );
}
