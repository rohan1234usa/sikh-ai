import type { ReactNode } from 'react';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

// A link to another site, in a new tab, saying so: visibly with the icon, and
// to screen readers with `newTab` ("(opens in a new tab)", in the page's
// language). It sends no referrer and gives that site no handle on this tab.
export default function ExternalLink({ href, newTab, className, children }: {
    href: string;
    newTab: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
            {children}
            <ArrowTopRightOnSquareIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="sr-only"> {newTab}</span>
        </a>
    );
}
