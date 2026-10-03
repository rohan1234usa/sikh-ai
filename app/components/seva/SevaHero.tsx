import IntentLink from '@/app/components/IntentLink';
import { BUTTON_LG, PRIMARY_BUTTON } from '@/app/components/buttons';
import type { Lang } from '@/lib/i18n/config';
import type { SevaCopy } from '@/lib/i18n/seva';

// The top of the board: what the page is, a way to host, and the line of
// Gurbani the page has always carried, marked up as a quotation in its own
// script (Gurmukhi on the Punjabi page, romanized elsewhere).
export default function SevaHero({ lang, copy, hostHref, angHref }: {
    lang: Lang;
    copy: SevaCopy['board'];
    hostHref: string;
    angHref: string;
}) {
    return (
        <section className="bg-navy px-4 py-8 text-white sm:px-6 md:py-10 [--focus-ring:var(--color-kesri)]">
            <div className="mx-auto max-w-4xl">
                <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold md:text-4xl">{copy.title}</h1>
                        <p className="mt-2 max-w-xl text-slate-300">{copy.lead}</p>
                    </div>
                    <IntentLink href={hostHref} className={`${PRIMARY_BUTTON} ${BUTTON_LG} shrink-0`}>
                        {copy.hostCta}
                    </IntentLink>
                </div>
                <figure className="mt-6 border-l-2 border-kesri/60 pl-4">
                    <blockquote lang={lang === 'pa' ? 'pa' : 'pa-Latn'} className={lang === 'pa' ? 'font-gurmukhi text-lg' : 'italic'}>
                        <p>{copy.quote}</p>
                    </blockquote>
                    <figcaption className="mt-1 text-sm text-slate-300">
                        {copy.quoteMeaning}{' '}
                        <span className="text-slate-400">{copy.quoteSource} · </span>
                        <IntentLink href={angHref} className="text-slate-200 underline hover:text-white">{copy.readAng}</IntentLink>
                    </figcaption>
                </figure>
            </div>
        </section>
    );
}
