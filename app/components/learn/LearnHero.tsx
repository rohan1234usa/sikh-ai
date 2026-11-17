import type { LearnCopy } from '@/lib/i18n/learn';

// The top of /learn: the page header the translator and Shabad pages share.
// The caveat that lessons are AI-drafted sits at the hub's foot, and at
// every lesson's.
export default function LearnHero({ learn }: { learn: LearnCopy }) {
    // Word order around the highlighted word differs per language.
    const [before, after] = learn.title.split('{word}');
    return (
        <div className="border-b border-edge bg-surface text-ink py-12 px-6 flex flex-col items-center text-center">
            <h1 className="text-3xl md:text-4xl font-semibold mb-3">
                {before}<span className="text-accent-text">{learn.titleWord}</span>{after}
            </h1>
            <p className="max-w-2xl text-ink-muted">{learn.subtitle}</p>
        </div>
    );
}
