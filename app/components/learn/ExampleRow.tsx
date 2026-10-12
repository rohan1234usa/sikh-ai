import CopyButton from '@/app/components/translate/CopyButton';
import type { Example } from '@/lib/learn/config';
import { TukkLines } from '../gurbani/Tukk';
import Mixed from './Mixed';

// One Punjabi example in all three renditions, with its Gurmukhi copyable.
// Hook-free, so both the lesson pages (server) and the word list (client)
// use it; the caller passes the copy button's label.
export default function ExampleRow({ example, copyLabel }: { example: Example; copyLabel: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
                <TukkLines voice="learn" size="page" gurmukhi={example.gurmukhi} transliteration={example.roman} translation={<Mixed text={example.english} />} />
                {example.note && <p lang="en" className="mt-0.5 font-sans text-xs italic text-ink-muted"><Mixed text={example.note} /></p>}
            </div>
            <CopyButton text={example.gurmukhi} ariaLabel={copyLabel} />
        </div>
    );
}
