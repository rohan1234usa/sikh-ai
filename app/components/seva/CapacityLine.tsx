import type { SignupLine } from '@/lib/seva/display';

// Who may join and how many have, in words. With a limit, a bar beside them
// only shows it: screen readers get the words ("Volunteers: 3 of 20 · Spots
// left: 17"), which say it better than a meter would. No bar until someone
// has joined (anyJoined): an empty one looks like a page still loading. From
// the first volunteer its fill is at least a dot, though 1 of 500 rounds to
// 0%. Without a limit, or for an event that takes no sign-ups, just the words.
export default function CapacityLine({ signup, anyJoined }: { signup: SignupLine; anyJoined: boolean }) {
    if (signup.mode !== 'limited') return <span>{signup.text}</span>;
    return (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{signup.text} · {signup.left}</span>
            {anyJoined && (
                <span aria-hidden="true" className="inline-block h-1.5 w-24 overflow-hidden rounded-full bg-edge-strong/40">
                    <span className="block h-full min-w-1.5 rounded-full bg-kesri-deep dark:bg-kesri" style={{ width: `${signup.percent}%` }} />
                </span>
            )}
        </span>
    );
}
