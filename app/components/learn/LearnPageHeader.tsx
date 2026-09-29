import IntentLink from '@/app/components/IntentLink';
import type { Dictionary } from '@/lib/i18n';
import Mixed from './Mixed';

type Crumb = { href: string; label: string };

// The top of every page below /learn: where you are, then the page's title.
// Lesson titles and summaries are English in every UI language, so the
// caller says which language the title is in.
export default function LearnPageHeader({ t, crumbs, eyebrow, title, lead, lang }: {
    t: Dictionary;
    crumbs: Crumb[];
    eyebrow?: string;
    title: string;
    lead?: string;
    lang?: 'en';
}) {
    return (
        <header className="space-y-2">
            <nav aria-label={t.learn.breadcrumbAria}>
                <ol className="flex flex-wrap items-center gap-1 text-sm text-ink-muted">
                    {crumbs.map((crumb, i) => (
                        <li key={crumb.href} className="flex items-center gap-1">
                            {i > 0 && <span aria-hidden="true">›</span>}
                            <IntentLink href={crumb.href} className="hover:text-ink hover:underline">
                                {crumb.label}
                            </IntentLink>
                        </li>
                    ))}
                </ol>
            </nav>
            {eyebrow && <p className="text-xs uppercase tracking-widest text-accent-text font-bold">{eyebrow}</p>}
            <h1 lang={lang} className="text-3xl font-bold text-ink"><Mixed text={title} /></h1>
            {lead && <p lang={lang} className="max-w-2xl text-ink-muted"><Mixed text={lead} /></p>}
        </header>
    );
}
