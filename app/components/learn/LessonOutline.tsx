import { ChevronRightIcon } from '@heroicons/react/24/outline';
import type { Dictionary } from '@/lib/i18n';
import { fmt } from '@/lib/i18n/fmt';
import { sectionAnchor } from '@/lib/learn/config';
import Mixed from './Mixed';

// "In this lesson": the section headings as links, so the shape of a lesson
// shows before it is read. Open from sm up; on a phone, one line that opens
// to the list. Rendered on the server, from headings already on the page;
// the hidden copy of the list is out of the tab order and the reading order.
export default function LessonOutline({ t, headings }: { t: Dictionary; headings: string[] }) {
    const count = fmt(t.learn.lesson.sectionCount, { n: headings.length });
    const list = (
        <ol className="space-y-1.5">
            {headings.map((heading, i) => (
                <li key={i} className="flex items-baseline gap-3">
                    <span aria-hidden="true" className="w-4 shrink-0 text-right font-semibold tabular-nums text-accent-text">{i + 1}</span>
                    <a href={`#${sectionAnchor(i)}`} lang="en" className="min-w-0 text-link hover:underline">
                        <Mixed text={heading} />
                    </a>
                </li>
            ))}
        </ol>
    );

    return (
        <nav aria-label={t.learn.lesson.outline} className="border-y border-edge py-3 text-sm">
            <details className="group sm:hidden">
                <summary className="flex min-h-6 cursor-pointer list-none items-center gap-1.5 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-open:rotate-90" aria-hidden="true" />
                    {count}
                </summary>
                <div className="pt-3">{list}</div>
            </details>
            <div className="hidden space-y-2 sm:block">
                <p className="text-xs font-bold uppercase tracking-widest text-accent-text">{t.learn.lesson.outline} · {count}</p>
                {list}
            </div>
        </nav>
    );
}
