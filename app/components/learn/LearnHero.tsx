import type { Dictionary } from '@/lib/i18n';

// The top of /learn: the page header the translator and Shabad pages share.
// The caveat that lessons are AI-drafted sits at the hub's foot, and at
// every lesson's.
export default function LearnHero({ t }: { t: Dictionary }) {
    // Word order around the highlighted word differs per language.
    const [before, after] = t.learn.title.split('{word}');
    return (
        <div className="border-b border-edge bg-surface text-ink py-12 px-6 flex flex-col items-center text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
                {before}<span className="text-accent-text">{t.learn.titleWord}</span>{after}
            </h1>
            <p className="max-w-2xl text-ink-muted">{t.learn.subtitle}</p>
        </div>
    );
}
