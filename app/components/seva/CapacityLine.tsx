// How many have joined, in words, with a bar beside them that only shows it:
// screen readers get the words ("Volunteers: 3 of 20 · Spots left: 17"),
// which say it better than a meter would. No bar until someone has joined:
// an empty one looks like a page still loading. From the first volunteer its
// fill is at least a dot.
export default function CapacityLine({ capacity, spotsLeft, percent, full, fullLabel }: {
    capacity: string;
    spotsLeft: string;
    percent: number;
    full: boolean;
    fullLabel: string;
}) {
    return (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{capacity} · {full ? fullLabel : spotsLeft}</span>
            {percent > 0 && (
                <span aria-hidden="true" className="inline-block h-1.5 w-24 overflow-hidden rounded-full bg-edge-strong/40">
                    <span className="block h-full min-w-1.5 rounded-full bg-kesri-deep dark:bg-kesri" style={{ width: `${percent}%` }} />
                </span>
            )}
        </span>
    );
}
