import CopyButton from '@/app/components/translate/CopyButton';
import type { Example } from '@/lib/learn/config';
import Mixed from './Mixed';

// One Punjabi example in all three renditions, with its Gurmukhi copyable.
// Hook-free, so both the lesson pages (server) and the word list (client)
// use it; the caller passes the copy button's label.
export default function ExampleRow({ example, copyLabel }: { example: Example; copyLabel: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 space-y-0.5">
                <p lang="pa" className="font-gurmukhi text-2xl leading-relaxed text-ink">{example.gurmukhi}</p>
                <p lang="pa-Latn" className="font-medium text-ink">{example.roman}</p>
                <p lang="en" className="text-sm text-ink-muted"><Mixed text={example.english} /></p>
                {example.note && <p lang="en" className="text-xs italic text-ink-muted"><Mixed text={example.note} /></p>}
            </div>
            <CopyButton text={example.gurmukhi} ariaLabel={copyLabel} />
        </div>
    );
}
