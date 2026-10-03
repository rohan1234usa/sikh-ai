// How many have joined, in words, with a bar beside them that only shows it:
// screen readers get the words ("Volunteers: 3 of 20 · Spots left: 17"),
// which say it better than a meter would.
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
            <span aria-hidden="true" className="inline-block h-1.5 w-24 overflow-hidden rounded-full bg-edge">
                <span className="block h-full rounded-full bg-kesri-deep dark:bg-kesri" style={{ width: `${percent}%` }} />
            </span>
        </span>
    );
}
