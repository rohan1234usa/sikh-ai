'use client';

import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import { useT } from '../context/LanguageContext';

// The body of the 404 and error pages. It sits on the same theme tokens as
// every other page, so it follows the user's theme (Next's built-in fallback
// pages paint their own white, or OS-dark, body), and its copy comes from
// useT(), so a language switch updates it in place like the rest of the UI.
export function StatusPage({ code, heading, body, children }: {
    code?: string;
    heading: string;
    body: string;
    children: ReactNode;
}) {
    return (
        <main className="flex-1 flex items-center justify-center px-4 py-20">
            <div className="max-w-md text-center space-y-4">
                {code && <p className="text-sm font-semibold tracking-widest text-accent-text">{code}</p>}
                <h1 className="text-3xl font-bold text-ink">{heading}</h1>
                <p className="text-ink-muted">{body}</p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">{children}</div>
            </div>
        </main>
    );
}

/** The site's primary call-to-action look (as on the seva page). */
export const PRIMARY_BUTTON =
    'inline-block bg-kesri text-navy text-sm font-bold px-5 py-2.5 rounded-lg hover:bg-kesri-hover transition-colors shadow-md shadow-kesri/20';

export function NotFoundContent() {
    const t = useT();
    // The title is server metadata, and a language switch can't refresh it on
    // a 404 URL (router.refresh() fails there), so keep it in step here.
    useEffect(() => {
        document.title = t.meta.titleTemplate.replace('%s', t.meta.notFoundTitle);
    }, [t]);
    return (
        <StatusPage code="404" heading={t.notFound.heading} body={t.notFound.body}>
            <Link href="/" className={PRIMARY_BUTTON}>{t.notFound.home}</Link>
        </StatusPage>
    );
}
