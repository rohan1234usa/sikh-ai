import { lineAnchor } from '@/lib/gurbani/shabad';
import { TukkLines } from '../gurbani/Tukk';

// The look of the line an address points at: CSS :target on a full page
// load, data-highlighted (./LineHighlight) after a move within the site.
export const LINE_TARGET_STYLE =
    'scroll-mt-20 outline-none target:bg-rule-gold/10 target:ring-2 target:ring-rule-gold data-highlighted:bg-rule-gold/10 data-highlighted:ring-2 data-highlighted:ring-rule-gold';

// One line of a shabad: the Gurmukhi, then GurbaniNow's transliteration and
// translation, each exactly as the source gives it. Headings and the mangal
// are set smaller than the verses.
export default function ShabadVerse({ line }: {
    line: { id: string; kind: 'mangal' | 'header' | 'verse'; gurmukhi: string; transliteration: string; translation: string };
}) {
    return (
        <div id={lineAnchor(line.id)} tabIndex={-1} className={`px-3 py-4 text-center transition-colors ${LINE_TARGET_STYLE}`}>
            <TukkLines kind={line.kind} size="page" gurmukhi={line.gurmukhi} transliteration={line.transliteration} translation={line.translation} />
        </div>
    );
}
