import { fmt } from '@/lib/i18n/fmt';

// How much room a long field has left, shown once it's 80% full, as in the
// chat box; reaching the limit is announced. `count` is "{n} / {max}" and
// `limit` "Character limit reached: {max}", in the page's language.
export function CharCount({ id, length, max, count, limit }: {
    id: string;
    length: number;
    max: number;
    count: string;
    limit: string;
}) {
    const atCap = length >= max;
    return (
        <div className="mt-1 flex justify-end text-sm text-ink-muted">
            {length >= max * 0.8 && (
                <span id={id} className={`tabular-nums ${atCap ? 'font-semibold text-red-700 dark:text-red-400' : ''}`}>
                    {fmt(count, { n: length, max })}
                </span>
            )}
            <span className="sr-only" aria-live="polite">{atCap ? fmt(limit, { max }) : ''}</span>
        </div>
    );
}
