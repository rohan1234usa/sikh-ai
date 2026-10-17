import CopyButton from '@/app/components/translate/CopyButton';
import type { Example } from '@/lib/learn/config';
import { TukkLines } from '../gurbani/Tukk';
import Mixed from './Mixed';

// One Punjabi example as a tukk: the Gurmukhi, its romanization and its
// meaning stacked, with any note under them. Hook-free, so both the lesson
// pages (server) and the word list (client) use it. The word list passes a
// label for a copy button; a lesson's examples have none, since their
// Gurmukhi is plain text to select.
export default function ExampleRow({ example, copyLabel }: { example: Example; copyLabel?: string }) {
    const lines = (
        <>
            <TukkLines voice="learn" size="page" gurmukhi={example.gurmukhi} transliteration={example.roman} translation={<Mixed text={example.english} />} />
            {example.note && <p lang="en" className="mt-0.5 font-sans text-xs italic text-ink-muted"><Mixed text={example.note} /></p>}
        </>
    );
    if (!copyLabel) return lines;
    return (
        <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">{lines}</div>
            <CopyButton text={example.gurmukhi} ariaLabel={copyLabel} />
        </div>
    );
}
