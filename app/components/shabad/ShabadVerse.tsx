import { lineAnchor } from '@/lib/gurbani/shabad';

// The look of the line an address points at: CSS :target on a full page
// load, data-highlighted (./LineHighlight) after a move within the site.
export const LINE_TARGET_STYLE =
    'scroll-mt-20 outline-none target:bg-kesri/10 target:ring-2 target:ring-kesri/60 data-highlighted:bg-kesri/10 data-highlighted:ring-2 data-highlighted:ring-kesri/60';

// One line of a shabad: the Gurmukhi, then GurbaniNow's transliteration and
// translation, each exactly as the source gives it. Headings and the mangal
// are set smaller than the verses.
export default function ShabadVerse({ line }: {
    line: { id: string; kind: 'mangal' | 'header' | 'verse'; gurmukhi: string; transliteration: string; translation: string };
}) {
    const verse = line.kind === 'verse';
    return (
        <div id={lineAnchor(line.id)} tabIndex={-1} className={`rounded-xl px-3 py-4 text-center transition-colors ${LINE_TARGET_STYLE}`}>
            <p lang="pa" className={verse
                ? 'font-gurmukhi text-2xl md:text-3xl font-bold leading-relaxed text-ink'
                : 'font-gurmukhi text-lg md:text-xl leading-relaxed text-ink-muted'}>
                {line.gurmukhi}
            </p>
            {line.transliteration && (
                <p lang="pa-Latn" className="mt-2 text-sm md:text-base text-ink-faint">{line.transliteration}</p>
            )}
            {line.translation && (
                <p lang="en" className="mt-2 italic text-ink-muted md:text-lg">{line.translation}</p>
            )}
        </div>
    );
}
