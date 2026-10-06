// How many have joined, in words, with a bar beside them that only shows it:
// screen readers get the words ("Volunteers: 3 of 20 · Spots left: 17"),
// which say it better than a meter would. No bar until someone has joined
// (anyJoined): an empty one looks like a page still loading. From the first
// volunteer its fill is at least a dot, though 1 of 500 rounds to 0%.
export default function CapacityLine({ capacity, spotsLeft, percent, anyJoined, full, fullLabel }: {
    capacity: string;
    spotsLeft: string;
    percent: number;
    anyJoined: boolean;
    full: boolean;
    fullLabel: string;
}) {
    return (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{capacity} · {full ? fullLabel : spotsLeft}</span>
            {anyJoined && (
                <span aria-hidden="true" className="inline-block h-1.5 w-24 overflow-hidden rounded-full bg-edge-strong/40">
                    <span className="block h-full min-w-1.5 rounded-full bg-kesri-deep dark:bg-kesri" style={{ width: `${percent}%` }} />
                </span>
            )}
        </span>
    );
}
