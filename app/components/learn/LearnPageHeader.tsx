import type { ReactNode } from 'react';
import Breadcrumbs, { type Crumb } from '@/app/components/Breadcrumbs';
import type { Dictionary } from '@/lib/i18n';
import Mixed from './Mixed';

// The top of every page below /learn: where you are, then the page's title.
// Lesson titles and summaries are English in every UI language, so the
// caller says which language the title is in. An action (a lesson's "Skip
// to the quiz") shares the eyebrow's line, and anything after the lead (its
// outline) sits close under it.
export default function LearnPageHeader({ t, crumbs, eyebrow, action, title, lead, lang, children }: {
    t: Dictionary;
    crumbs: Crumb[];
    eyebrow?: string;
    action?: ReactNode;
    title: string;
    lead?: string;
    lang?: 'en';
    children?: ReactNode;
}) {
    return (
        <header className="space-y-2">
            <Breadcrumbs label={t.learn.breadcrumbAria} crumbs={crumbs} />
            {(eyebrow || action) && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    {eyebrow && <p className="text-xs uppercase tracking-widest text-accent-text font-bold">{eyebrow}</p>}
                    {action}
                </div>
            )}
            <h1 lang={lang} className="text-3xl font-bold text-ink"><Mixed text={title} /></h1>
            {lead && <p lang={lang} className="max-w-2xl text-ink-muted"><Mixed text={lead} /></p>}
            {children && <div className="pt-3">{children}</div>}
        </header>
    );
}
