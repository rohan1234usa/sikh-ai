import type { Dictionary } from '@/lib/i18n';

// The top of /learn: the navy band the translator and Shabad pages share.
export default function LearnHero({ t }: { t: Dictionary }) {
    // Word order around the highlighted word differs per language.
    const [before, after] = t.learn.title.split('{word}');
    return (
        <div className="bg-navy text-white py-12 px-6 flex flex-col items-center text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
                {before}<span className="text-kesri">{t.learn.titleWord}</span>{after}
            </h1>
            <p className="max-w-2xl text-slate-300">{t.learn.subtitle}</p>
            <p className="mt-3 max-w-2xl text-xs italic text-slate-400">{t.learn.caveat}</p>
        </div>
    );
}
